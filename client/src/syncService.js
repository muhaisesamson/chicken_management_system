import dbService from "./dbService";

const sync = async () => {
  return dbService.getAllRecords();
};

export default {
  sync,
};
