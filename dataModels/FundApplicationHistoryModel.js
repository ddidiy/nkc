const settings = require('../settings');
const mongoose = settings.database;
const Schema = mongoose.Schema;
const fundApplicationHistorySchema = new Schema({
  _id: Number,
  fundId: {
    type: Number,
    required: true
  },
  uid: {
    type: String,
    required: true,
    index: 1
  },
  budgetMoney: {
    type: [Schema.Types.Mixed],
    required: true
  },
  projectCycle: {
    type: Number,
    required: true
  },
  members: {
    type: [Schema.Types.Mixed],
    default: []
  },
  /*
  {
    uid: String,
    name: String,
    idCard: String,
    idCardPhotoPath: [String],
    lifePhotoPath: [String],
    handheldIdCartPath: [String],
    certPhotoPath: [String]
  }
  */
  thread: {
    type: [String],
    default:[]
  },
  paper: {
    type: [String],
    default: []
  },
  account: {
    paymentMethod: {
      type: String,
      required: true
    },
    number: {
      type: Number,
      required: true
    }
  },
  project: {
    name: {
      type: String,
      required: true
    },
    aim: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  reviseCount: {
    type: Number,
    required: true
  },
  refuseReason: {
    type: String,
    default: ''
  }
}, {
  collection: 'fundApplicationHistories'
});

const FundApplicationHistoryModel = mongoose.model('fundApplicationHistories', fundApplicationHistorySchema);
module.exports = FundApplicationHistoryModel;