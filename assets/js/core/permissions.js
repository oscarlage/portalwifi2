const GLOBAL_ADMIN_ROLES = Object.freeze([
	'platform_admin',
	'platform_operator',
	'platform_support',
	'platform_viewer',
]);

const TENANT_ADMIN_ROLES = Object.freeze([
	'tenant_admin',
	'tenant_manager',
	'tenant_viewer',
]);

const ALL_ROLES = Object.freeze([...GLOBAL_ADMIN_ROLES, ...TENANT_ADMIN_ROLES]);

function normalizeString(value) {
	return String(value || '').trim().toLowerCase();
}

function normalizeRole(role) {
	const normalized = normalizeString(role);
	return ALL_ROLES.includes(normalized) ? normalized : null;
}

function normalizeMembership(membership = {}) {
	return {
		...membership,
		role: normalizeRole(membership.role),
		tenant_id: membership.tenant_id || null,
		unit_id: membership.unit_id || null,
		is_active: membership.is_active !== false,
	};
}

export function isPlatformRole(role) {
	return GLOBAL_ADMIN_ROLES.includes(normalizeRole(role));
}

export function isTenantRole(role) {
	return TENANT_ADMIN_ROLES.includes(normalizeRole(role));
}

export function getRoleScope(role) {
	if (isPlatformRole(role)) return 'global';
	if (isTenantRole(role)) return 'tenant';
	return 'unknown';
}

export function getTenantRoleRank(role) {
	const normalized = normalizeRole(role);

	if (normalized === 'tenant_admin') return 300;
	if (normalized === 'tenant_manager') return 200;
	if (normalized === 'tenant_viewer') return 100;
	return 0;
}

export function getPlatformRoleRank(role) {
	const normalized = normalizeRole(role);

	if (normalized === 'platform_admin') return 400;
	if (normalized === 'platform_operator') return 300;
	if (normalized === 'platform_support') return 200;
	if (normalized === 'platform_viewer') return 100;
	return 0;
}

export function getHighestTenantRole(memberships = []) {
	return memberships
		.map(normalizeMembership)
		.filter((membership) => membership.is_active && membership.role)
		.sort((left, right) => getTenantRoleRank(right.role) - getTenantRoleRank(left.role))[0]?.role || null;
}

export function resolveAccessContext(profile = {}, memberships = []) {
	const platformRole = normalizeRole(profile.platform_role);
	const normalizedMemberships = memberships
		.map(normalizeMembership)
		.filter((membership) => membership.is_active);

	const highestTenantRole = getHighestTenantRole(normalizedMemberships);
	const scope = isPlatformRole(platformRole)
		? 'global'
		: highestTenantRole
			? 'tenant'
			: 'none';

	return {
		scope,
		platformRole,
		tenantRole: highestTenantRole,
		memberships: normalizedMemberships,
		canAccessGlobalAdmin: isPlatformRole(platformRole),
		canAccessTenantAdmin: !!highestTenantRole || isPlatformRole(platformRole),
	};
}

export function canAccessGlobalAdmin(profile = {}, memberships = []) {
	return resolveAccessContext(profile, memberships).canAccessGlobalAdmin;
}

export function canAccessTenantAdmin(profile = {}, memberships = [], tenantId = null) {
	const access = resolveAccessContext(profile, memberships);

	if (access.canAccessGlobalAdmin) {
		return true;
	}

	if (!tenantId) {
		return access.canAccessTenantAdmin;
	}

	return access.memberships.some((membership) => membership.tenant_id === tenantId);
}

export function canManageTenant(profile = {}, memberships = [], tenantId = null) {
	const access = resolveAccessContext(profile, memberships);

	if (getPlatformRoleRank(access.platformRole) >= 300) {
		return true;
	}

	return access.memberships.some((membership) => {
		if (tenantId && membership.tenant_id !== tenantId) {
			return false;
		}

		return getTenantRoleRank(membership.role) >= 200;
	});
}

export function canManageUsers(profile = {}, memberships = [], tenantId = null) {
	const access = resolveAccessContext(profile, memberships);

	if (getPlatformRoleRank(access.platformRole) >= 400) {
		return true;
	}

	return access.memberships.some((membership) => {
		if (tenantId && membership.tenant_id !== tenantId) {
			return false;
		}

		return membership.role === 'tenant_admin';
	});
}

export function canManageCampaigns(profile = {}, memberships = [], tenantId = null) {
	return canManageTenant(profile, memberships, tenantId);
}

export function canManageSettings(profile = {}, memberships = [], tenantId = null) {
	return canManageTenant(profile, memberships, tenantId);
}

export function canViewReports(profile = {}, memberships = [], tenantId = null) {
	const access = resolveAccessContext(profile, memberships);

	if (access.canAccessGlobalAdmin) {
		return true;
	}

	return access.memberships.some((membership) => {
		if (tenantId && membership.tenant_id !== tenantId) {
			return false;
		}

		return getTenantRoleRank(membership.role) >= 100;
	});
}

export function assertPermission(check, message = 'Acesso não autorizado.') {
	if (!check) {
		throw new Error(message);
	}
}

export { ALL_ROLES, GLOBAL_ADMIN_ROLES, TENANT_ADMIN_ROLES };

