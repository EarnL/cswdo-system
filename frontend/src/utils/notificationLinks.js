const roleLinkMap = {
  admin: {
    '/staff/population-data': '/admin/population-data',
    '/staff/accreditation': '/admin/accreditation',
    '/staff/regular-programs': '/admin/programs/feeding',
    '/admin/regular-programs': '/admin/programs/feeding',
    '/staff/reports': '/admin/reports',
  },
  staff: {
    '/admin/population-data': '/staff/population-data',
    '/admin/accreditation': '/staff/accreditation',
    '/admin/regular-programs': '/staff/regular-programs',
    '/admin/reports': '/staff/reports',
  },
};

const appendNotificationFocus = (link, notification) => {
  if (!link || !notification?.source_key) {
    return link;
  }

  const [pathAndQuery, hash = ''] = link.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const params = new URLSearchParams(query);
  params.set('notification_focus', notification.source_key);
  if (notification.category) {
    params.set('notification_category', notification.category);
  }

  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
};

export const normalizeNotificationLink = (link, role = localStorage.getItem('role'), notification = null) => {
  if (!link) {
    return link;
  }

  const normalizedLink = roleLinkMap[role]?.[link] || link;
  return appendNotificationFocus(normalizedLink, notification);
};
