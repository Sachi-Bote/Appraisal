const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const getProfileRouteByRole = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "HOD") return "/hod/profile";
  if (normalized === "PRINCIPAL") return "/principal/profile";
  return "/faculty/profile";
};

export { getProfileRouteByRole, normalizeRole };
