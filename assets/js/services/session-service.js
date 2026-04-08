import { getSupabaseClient } from '../core/supabase-client.js';
import { summarizeLeads } from './lead-service.js';

const DEFAULT_TENANT_KEY = 'portalwifi.activeTenantId';
const API_BASE = resolveApiBase();

function resolveApiBase() {
	return String(
		window.PORTAL_SETTINGS?.apiBase ||
		document.body?.dataset?.apiBase ||
		localStorage.getItem('portal_api_base') ||
		'https://portalwifi-api.oscar-lage.workers.dev'
	).replace(/\/$/, '');
}

function getTenantId(explicitTenantId = null) {
	return explicitTenantId || localStorage.getItem(DEFAULT_TENANT_KEY) || '';
}

function normalizeSession(session = {}) {
	return {
		id: session.id || null,
		tenant_id: session.tenant_id || null,
		unit_id: session.unit_id || null,
		device_id: session.device_id || null,
		login_time: session.login_time || null,
		logout_time: session.logout_time || null,
		duration_seconds: Number(session.duration_seconds || 0),
		ip_address: session.ip_address || null,
		access_point: session.access_point || '',
		nas_identifier: session.nas_identifier || '',
		mikrotik_session_id: session.mikrotik_session_id || '',
		auth_method: session.auth_method || '',
		created_at: session.created_at || null,
		updated_at: session.updated_at || null,
	};
}

function buildQuery(params) {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			query.set(key, value);
		}
	});

	return query.toString();
}

function normalizeDateFilterRange(filters = {}) {
	const now = new Date();
	const end = filters.date_to ? new Date(filters.date_to) : new Date(now);
	const start = filters.date_from ? new Date(filters.date_from) : new Date(now);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return { date_from: filters.date_from || '', date_to: filters.date_to || '' };
	}

	if (filters.period === 'today') {
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	} else if (filters.period === '7d') {
		start.setDate(now.getDate() - 6);
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	} else if (filters.period === '30d') {
		start.setDate(now.getDate() - 29);
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	} else {
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	}

	return {
		date_from: start.toISOString(),
		date_to: end.toISOString(),
	};
}

function applySessionFilters(query, filters = {}) {
	let nextQuery = query;

	if (filters.unit_id) {
		nextQuery = nextQuery.eq('unit_id', filters.unit_id);
	}

	if (filters.date_from) {
		nextQuery = nextQuery.gte('login_time', new Date(filters.date_from).toISOString());
	}

	if (filters.date_to) {
		const end = new Date(filters.date_to);
		if (!Number.isNaN(end.getTime())) {
			end.setHours(23, 59, 59, 999);
			nextQuery = nextQuery.lte('login_time', end.toISOString());
		}
	}

	return nextQuery;
}

export async function listSessions(tenantId, filters = {}) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId) {
		throw new Error('tenantId é obrigatório para listar sessões.');
	}

	const supabase = getSupabaseClient();
	let query = supabase
		.from('wifi_sessions')
		.select('*')
		.eq('tenant_id', resolvedTenantId)
		.order('login_time', { ascending: false });

	query = applySessionFilters(query, filters);

	const { data, error } = await query;

	if (error) {
		throw new Error(`Erro ao listar sessões: ${error.message}`);
	}

	return (data || []).map(normalizeSession);
}

export async function getSessionById(tenantId, sessionId) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId || !sessionId) {
		throw new Error('tenantId e sessionId são obrigatórios.');
	}

	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('wifi_sessions')
		.select('*')
		.eq('tenant_id', resolvedTenantId)
		.eq('id', sessionId)
		.single();

	if (error) {
		throw new Error(`Erro ao buscar sessão: ${error.message}`);
	}

	return normalizeSession(data);
}

export async function summarizeSessions(tenantId, filters = {}) {
	const sessions = await listSessions(tenantId, filters);
	const total = sessions.length;
	const active = sessions.filter((session) => !session.logout_time).length;
	const completed = sessions.filter((session) => !!session.logout_time).length;
	const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);

	return {
		total,
		active,
		completed,
		averageDurationSeconds: completed ? Math.round(totalDuration / completed) : 0,
	};
}

export async function getPeakHours(tenantId, filters = {}) {
	const sessions = await listSessions(tenantId, filters);
	const hourFrom = Number(filters.hour_from ?? 0);
	const hourTo = Number(filters.hour_to ?? 23);
	const buckets = Array.from({ length: 24 }, (_, hour) => ({
		hour,
		label: `${String(hour).padStart(2, '0')}:00`,
		value: 0,
	}));

	sessions.forEach((session) => {
		if (!session.login_time) {
			return;
		}

		const date = new Date(session.login_time);
		if (Number.isNaN(date.getTime())) {
			return;
		}

		buckets[date.getHours()].value += 1;
	});

	return buckets.filter((bucket) => bucket.hour >= hourFrom && bucket.hour <= hourTo);
}

export async function getReportSummary(tenantId, filters = {}) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId) {
		throw new Error('tenantId é obrigatório para gerar resumo.');
	}

	const query = buildQuery({ tenant_id: resolvedTenantId, ...filters });

	try {
		const response = await fetch(`${API_BASE}/api/admin/dashboard/summary?${query}`);
		const payload = await response.json().catch(() => ({}));

		if (!response.ok || payload.ok === false) {
			throw new Error(payload.detail || payload.error || 'Falha ao carregar resumo.');
		}

		return payload.summary || {};
	} catch (error) {
		console.warn('Falha ao buscar resumo via Worker, usando fallback local.', error);
		const normalizedRange = normalizeDateFilterRange(filters);
		const sessionSummary = await summarizeSessions(resolvedTenantId, normalizedRange);
		const leadSummary = await summarizeLeads(resolvedTenantId, normalizedRange);

		return {
			connected: sessionSummary.total,
			new_customers: leadSummary.total,
			returning_customers: Math.max(sessionSummary.total - leadSummary.total, 0),
			marketing_optin: leadSummary.marketingOptin,
		};
	}
}

export async function getPeakHoursReport(tenantId, filters = {}) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId) {
		throw new Error('tenantId é obrigatório para horários de pico.');
	}

	const query = buildQuery({ tenant_id: resolvedTenantId, ...filters });

	try {
		const response = await fetch(`${API_BASE}/api/admin/reports/peak-hours?${query}`);
		const payload = await response.json().catch(() => ({}));

		if (!response.ok || payload.ok === false) {
			throw new Error(payload.detail || payload.error || 'Falha ao carregar horários de pico.');
		}

		return payload.hours || [];
	} catch (error) {
		console.warn('Falha ao buscar horários de pico via Worker, usando fallback local.', error);
		const normalizedRange = normalizeDateFilterRange(filters);
		return getPeakHours(resolvedTenantId, { ...filters, ...normalizedRange });
	}
}

