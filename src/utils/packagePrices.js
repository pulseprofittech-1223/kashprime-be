const PACKAGE_PRICES = {
  'Amateur': 9500.00,
  'Pro': 15000.00
};

const getPackagePrice = (packageType) => {
  return PACKAGE_PRICES[packageType] || null;
};

const getAllPackages = () => {
  return Object.keys(PACKAGE_PRICES).map(type => ({
    type,
    price: PACKAGE_PRICES[type],
    formattedPrice: formatPrice(PACKAGE_PRICES[type])
  }));
};

const formatPrice = (price) => {
  return `₦${parseFloat(price).toLocaleString()}`;
};

const getPackageDetails = (packageType) => {
  const price = getPackagePrice(packageType);
  if (!price) return null;

  const benefits = {
    'Amateur': {
      voxcoinWelcomeBonus: 8500,
      affiliateBonus: 7400,
      dailyVoxcoinGain: 2000,
      referralEarnings: { first: 200, second: 100 },
      socialMediaStreaks: 1,
      videoWatching: 1
    },
    'Pro': {
      voxcoinWelcomeBonus: 13000,
      affiliateBonus: 12000,
      dailyVoxcoinGain: 5000,
      referralEarnings: { first: 400, second: 100 },
      socialMediaStreaks: 2,
      videoWatching: 2
    }
  };

  return {
    type: packageType,
    price,
    formattedPrice: formatPrice(price),
    benefits: benefits[packageType]
  };
};

module.exports = {
  PACKAGE_PRICES,
  getPackagePrice,
  getAllPackages,
  formatPrice,
  getPackageDetails
};
 