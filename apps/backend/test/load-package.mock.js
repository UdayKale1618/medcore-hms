const loadPackage = async (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};
const loadPackageSync = (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};
const loadPackageCached = (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};
const tryLoadPackage = async (name) => {
  try {
    return require(name);
  } catch {
    return null;
  }
};

module.exports = {
  loadPackage,
  loadPackageSync,
  loadPackageCached,
  tryLoadPackage,
};
