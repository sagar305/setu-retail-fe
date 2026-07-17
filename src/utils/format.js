// Indian-locale number formatting shared across pages
export const formatINR = (num, decimals = 0) => {
  const n = Number(num) || 0;
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatNumber = (num) => (Number(num) || 0).toLocaleString('en-IN');
