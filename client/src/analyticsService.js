import dbService from "./dbService";

const parseNumber = (value) => Number(value || 0);

const groupByDate = (records, key) => {
  const map = {};
  records.forEach((record) => {
    const date = record.date || "";
    map[date] = (map[date] || 0) + parseNumber(record[key]);
  });
  return Object.keys(map)
    .sort()
    .map((date) => ({ date, value: map[date] }));
};

const getTotals = async () => {
  const records = await dbService.getAllRecords();
  return {
    totalDeaths: records.reduce((sum, item) => sum + parseNumber(item.deaths), 0),
    totalFeed: records.reduce((sum, item) => sum + parseNumber(item.foodSupplied), 0),
    totalExpenses: records.reduce((sum, item) => sum + parseNumber(item.expenses), 0),
    totalIncome: records.reduce((sum, item) => sum + parseNumber(item.income), 0),
  };
};

const getFeedTrend = async () => groupByDate(await dbService.getAllRecords(), "foodSupplied");
const getDeathTrend = async () => groupByDate(await dbService.getAllRecords(), "deaths");
const getIncomeTrend = async () => groupByDate(await dbService.getAllRecords(), "income");
const getExpensesTrend = async () => groupByDate(await dbService.getAllRecords(), "expenses");

const getFeedVsDeaths = async () => {
  const records = await dbService.getAllRecords();
  const map = {};
  records.forEach((record) => {
    const date = record.date || "";
    if (!map[date]) {
      map[date] = { feed: 0, deaths: 0 };
    }
    map[date].feed += parseNumber(record.foodSupplied);
    map[date].deaths += parseNumber(record.deaths);
  });
  return Object.keys(map)
    .sort()
    .map((date) => ({ date, feed: map[date].feed, deaths: map[date].deaths }));
};

export default {
  getTotals,
  getFeedTrend,
  getDeathTrend,
  getIncomeTrend,
  getExpensesTrend,
  getFeedVsDeaths,
};
