import { getSupabaseClient } from '../core/supabase-client.js';
import { listLeads } from './lead-service.js';

function normalizeContact(contact = {}) {
	return {
		id: contact.id || null,
		tenant_id: contact.tenant_id || null,
		full_name: contact.full_name || '',
		email: contact.email || '',
		phone: contact.phone || '',
		city: contact.city || '',
		marketing_optin: contact.marketing_optin === true,
		source: contact.source || '',
		created_at: contact.created_at || null,
		updated_at: contact.updated_at || null,
	};
}

export async function listContacts(tenantId, filters = {}) {
	const leads = await listLeads(tenantId, filters);

	return leads
		.filter((lead) => lead.email || lead.phone || lead.full_name)
		.map(normalizeContact);
}

export async function getContactById(tenantId, contactId) {
	const supabase = getSupabaseClient();

	if (!tenantId || !contactId) {
		throw new Error('tenantId e contactId são obrigatórios.');
	}

	const { data, error } = await supabase
		.from('wifi_leads')
		.select('*')
		.eq('tenant_id', tenantId)
		.eq('id', contactId)
		.single();

	if (error) {
		throw new Error(`Erro ao buscar contato: ${error.message}`);
	}

	return normalizeContact(data);
}

export async function listMarketingContacts(tenantId, filters = {}) {
	const contacts = await listContacts(tenantId, filters);
	return contacts.filter((contact) => contact.marketing_optin);
}

export async function summarizeContacts(tenantId, filters = {}) {
	const contacts = await listContacts(tenantId, filters);

	return {
		total: contacts.length,
		marketingOptin: contacts.filter((contact) => contact.marketing_optin).length,
		withEmail: contacts.filter((contact) => !!contact.email).length,
		withPhone: contacts.filter((contact) => !!contact.phone).length,
	};
}

