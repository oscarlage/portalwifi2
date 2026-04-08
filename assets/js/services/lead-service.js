import { getSupabaseClient } from '../core/supabase-client.js';

const API_BASE = resolveApiBase();
const DEFAULT_TENANT_KEY = 'portalwifi.activeTenantId';

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

function toQuery(params) {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			query.set(key, value);
		}
	});

	return query.toString();
}

function normalizeLead(lead = {}) {
	return {
		id: lead.id || null,
		tenant_id: lead.tenant_id || null,
		unit_id: lead.unit_id || null,
		campaign_id: lead.campaign_id || null,
		full_name: lead.full_name || '',
		email: lead.email || '',
		phone: lead.phone || '',
		city: lead.city || '',
		source: lead.source || '',
		marketing_optin: lead.marketing_optin === true,
		created_at: lead.created_at || null,
		updated_at: lead.updated_at || null,
		created_day: lead.created_day || null,
	};
}

async function fetchLeadListFromApi(tenantId, filters = {}) {
	const query = toQuery({ tenant_id: tenantId, ...filters });
	const response = await fetch(`${API_BASE}/api/admin/leads?${query}`);
	const payload = await response.json().catch(() => ({}));

	if (!response.ok || payload.ok === false) {
		throw new Error(payload.detail || payload.error || 'Falha ao carregar leads.');
	}

	return Array.isArray(payload.data) ? payload.data.map(normalizeLead) : [];
}

async function fetchLeadListFromSupabase(tenantId, filters = {}) {
	const supabase = getSupabaseClient();
	let query = supabase
		.from('wifi_leads')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false });

	if (filters.unit_id) {
		query = query.eq('unit_id', filters.unit_id);
	}

	if (filters.campaign_id) {
		query = query.eq('campaign_id', filters.campaign_id);
	}

	if (filters.city) {
		query = query.ilike('city', `%${filters.city}%`);
	}

	if (filters.search) {
		const search = String(filters.search).trim();
		query = query.or([
			`full_name.ilike.%${search}%`,
			`email.ilike.%${search}%`,
			`phone.ilike.%${search}%`,
			`city.ilike.%${search}%`
		].join(','));
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(`Erro ao listar leads: ${error.message}`);
	}

	return (data || []).map(normalizeLead);
}

export async function listLeads(tenantId, filters = {}) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId) {
		throw new Error('tenantId é obrigatório para listar leads.');
	}

	try {
		return await fetchLeadListFromApi(resolvedTenantId, filters);
	} catch (error) {
		console.warn('Falha ao buscar leads via Worker, usando Supabase.', error);
		return fetchLeadListFromSupabase(resolvedTenantId, filters);
	}
}

export async function getLeadById(tenantId, leadId) {
	const resolvedTenantId = getTenantId(tenantId);

	if (!resolvedTenantId || !leadId) {
		throw new Error('tenantId e leadId são obrigatórios.');
	}

	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('wifi_leads')
		.select('*')
		.eq('tenant_id', resolvedTenantId)
		.eq('id', leadId)
		.single();

	if (error) {
		throw new Error(`Erro ao buscar lead: ${error.message}`);
	}

	return normalizeLead(data);
}

export async function listRecentLeads(tenantId, limit = 10) {
	return (await listLeads(tenantId)).slice(0, Math.max(1, limit));
}

export async function summarizeLeads(tenantId, filters = {}) {
	const leads = await listLeads(tenantId, filters);

	return {
		total: leads.length,
		marketingOptin: leads.filter((lead) => lead.marketing_optin).length,
		withEmail: leads.filter((lead) => !!lead.email).length,
		withPhone: leads.filter((lead) => !!lead.phone).length,
		byCity: leads.reduce((accumulator, lead) => {
			const city = lead.city || 'Não informado';
			accumulator[city] = (accumulator[city] || 0) + 1;
			return accumulator;
		}, {}),
	};
}

