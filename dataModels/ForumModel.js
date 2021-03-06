const settings = require('../settings');
const mongoose = settings.database;
const Schema = mongoose.Schema;
const {getQueryObj} = require('../nkcModules/apiFunction');

const forumSchema = new Schema({
	abbr: {
    type: String,
    default: '',
    max: [4, '简称必须小于等于4字']
  },
  class: {
    type: String,
    default: 'null'
  },
  color: {
    type: String,
    default: 'grey'
  },
  countPosts: {
    type: Number,
    default: 0
  },
  countThreads: {
    type: Number,
    default: 0
  },
  countPostsToday: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: '',
    max: [300, '描述应少于300字']
  },
  displayName: {
    type: String,
    required: true,
    min: [1, '板块名称必须大于等于1字'],
    max: [6, '板块名称必须小于等于6字']
  },
  iconFileName: {
    type: String,
    default: ''
  },
  isVisibleForNCC: {
    type: Boolean,
    default: false
  },
  moderators: {
    type: [String],
    default: []
  },
  order: {
    type: Number,
    default: 0
  },
  parentId: {
    type: String,
    default: ''
  },
  fid: {
    type: String,
    unique: true,
    required: true
  },
  tCount: {
    digest: {
      type: Number,
      default: 0
    },
    normal: {
      type: Number,
      default: 0
    }
  },
  type: {
    type: String,
    required: true,
    index: 1
  },
  visibility: {
    type: Boolean,
    default: false
  }
});

forumSchema.virtual('moderatorUsers')
	.get(function() {
		return this._moderatorUsers;
	})
	.set(function(moderatorUsers) {
		this._moderatorUsers = moderatorUsers;
	});

// 验证是否有权限进入此版块
forumSchema.methods.ensurePermission = async function (ctx) {
	const {contentClasses} = ctx.data.certificates;
	return contentClasses.includes(this.class);

};
// 若是父板块则返回有权限访问的子版块的fid
forumSchema.methods.getFidOfChildForum = async function (ctx) {
  const ForumModel = require('./ForumModel');
  let fidArr = [];
  fidArr.push(this.fid);
  if(this.type === 'category') {
    let forums = await ForumModel.find({parentId: this.fid});
    await Promise.all(forums.map(async forum => {
      if(await forum.ensurePermission(ctx))
        fidArr.push(forum.fid);
    }));
  }
  return fidArr;
};

// 加载版主
forumSchema.methods.extendModerators = async function() {
	const UserModel = require('./UserModel');
	const {moderators} = this;
	const moderatorUsers = [];
	for(let uid of moderators){
		const user = await UserModel.findOne({uid});
		if(user) {
			moderatorUsers.push(user);
		}
	}
	return this.moderatorUsers = moderatorUsers;
};

forumSchema.methods.getThreadsByQuery = async function(query, match) {
  const ThreadModel = require('./ThreadModel');
  const {$match, $sort, $skip, $limit} = getQueryObj(query, match);
  let threads = await ThreadModel.find($match).sort($sort).skip($skip).limit($limit);
  threads = await Promise.all(threads.map(async t => {
    await t.extendFirstPost().then(p => p.extendUser());
    await t.firstPost.extendResources();
    await t.extendLastPost().then(p => p.extendUser());
    return t;
  }));
  return threads;
};

forumSchema.methods.getThreadCountByQuery = async function(query) {
  const ThreadModel = require('./ThreadModel');
  return await ThreadModel.count(query);
};

forumSchema.methods.getToppedThreads = async function(fidOfChildForum) {
  const ThreadModel = require('./ThreadModel');
  let threads = await ThreadModel.find({fid: {$in: fidOfChildForum}, topped: true});
  threads = await Promise.all(threads.map(async t => {
    await t.extendFirstPost().then(p => p.extendUser());
    await t.firstPost.extendResources();
    await t.extendLastPost().then(p => p.extendUser());
    await t.lastPost.extendUser();
    return t;
  }));
  return threads;
};


forumSchema.methods.updateForumMessage = async function() {
  const ThreadModel = require('./ThreadModel');
  const ForumModel = require('./ForumModel');
  let forumData = await ThreadModel.aggregate([
    {
      $match: {
        fid: this.fid
      }
    },
    {
      $group: {
        _id: '$fid',
        countPosts: {$sum: '$count'},
        countPostsToday: {$sum: '$countToday'},
        countThreads: {$sum: 1}
      }
    },
    {
      $project: {
        _id: 0
      }
    }
  ]);
  forumData = forumData[0];
  const tCount = {
    digest: 0,
    normal: 0
  };
  tCount.digest = await ThreadModel.count({fid: this.fid, digest: true});
  tCount.normal = forumData.countThreads - tCount.digest;
  forumData.tCount = tCount;
  await this.update(forumData);
  if(!this.parentId) return;
  const parentForum = await ForumModel.findOnly({fid: this.parentId});
  const childForum = await ForumModel.find({parentId: this.parentId});
  const obj = {
    countPosts: 0,
    countPostsToday: 0,
    countThreads: 0,
    tCount: {
      digest: 0,
      normal: 0
    }
  };
  for (let forum of childForum) {
    obj.countPosts += forum.countPosts;
    obj.countPostsToday += forum.countPostsToday;
    obj.tCount.digest += forum.tCount.digest;
    obj.countThreads += forum.countThreads;
  }
  obj.tCount.normal = obj.countThreads - obj.tCount.digest;
  await parentForum.update(obj);
};


forumSchema.methods.newPost = async function(post, user, ip, cid, toMid) {
  const SettingModel = require('./SettingModel');
  const ThreadModel = require('./ThreadModel');
  const PersonalForumModel = require('./PersonalForumModel');
  const tid = await SettingModel.operateSystemID('threads', 1);
  const t = {
    tid,
    cid,
    fid: this.fid,
    mid: user.uid,
    uid: user.uid,
  };
  if(toMid && toMid !== user.uid) {
    const targetPF = await PersonalForumModel.findOnly({uid: toMid});
    if(targetPF.moderators.indexOf(user.uid) > -1)
      t.toMid = toMid;
    else
      throw (new Error("only personal forum's moderator is able to post"))
  }
  const thread = await new ThreadModel(t).save();
  const _post = await thread.newPost(post, user, ip, cid);
  await thread.update({$set:{lm: _post.pid, oc: _post.pid, count: 1, hits: 1}});
  await this.update({$inc: {
    'tCount.normal': 1,
    'countPosts': 1,
    'countThreads': 1
  }});
  return _post;
};

module.exports = mongoose.model('forums', forumSchema);