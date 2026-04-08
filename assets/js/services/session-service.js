import { getSupabaseClient } from '../core/supabase-client.js';

const DEFAULT_TENANT_KEY = 'portalwifi.activeTenantId';

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

	return buckets;
}

