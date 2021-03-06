const settings = require('../settings');
const mongoose = settings.database;
const {Schema} = mongoose;
const methodEnum = [
  'POST', 'GET', 'PATCH', 'PUT', 'DELETE'
];
const typeEnum = [
  'path', 'parameter'
];

const permissionSchema = new Schema({
  parent: {
    type: String
  },
  method: {
    type: String,
    enum: methodEnum,
    required: true,
    uppercase: true
  },
  path: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: typeEnum
  },
  belongTo: {
    type: [String],
    index: 1
  }
});

module.exports = mongoose.model('permissions', permissionSchema);