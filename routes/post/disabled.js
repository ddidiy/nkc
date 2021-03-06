const Router = require('koa-router');
const router = new Router();

router
  .patch('/', async (ctx, next) => {
    const {disabled} = ctx.body;
    const {pid} = ctx.params;
    const {db, data} = ctx;
    if(disabled === undefined) ctx.throw(400, '参数不正确');
    const targetPost = await db.PostModel.findOnly({pid});
    const targetThread = await db.ThreadModel.findOnly({tid: targetPost.tid});
    if(!await targetThread.ensurePermissionOfModerators(ctx)) ctx.throw(403,'权限不足');
    const obj = {disabled: false};
    if(disabled) obj.disabled = true;
    if(obj.disabled) {
    	const posts = await db.PostModel.find({tid: targetThread.tid, disabled: false}, {pid: 1});
    	if(posts.length === 1 && posts[0].pid === pid) {
		    ctx.throw(400, '无法屏蔽仅有一条post的帖子，请移动至回收站。');
	    }
    }
    await targetPost.update(obj);
    if(targetPost.disabled === disabled) {
      if(!disabled) ctx.throw(400, '操作失败！该回复未被屏蔽，请刷新');
      if(disabled) ctx.throw(400, '操作失败！该回复在您操作之前已经被屏蔽了，请刷新');
    }
    data.targetUser = await targetPost.extendUser();
    let operation = 'disablePost';
    if(!disabled) operation = 'enablePost';
    await ctx.generateUsersBehavior({
      operation,
      pid,
      tid: targetThread.tid,
      fid: targetThread.fid,
      isManageOp: true,
      toMid: targetThread.toMid,
      mid: targetThread.mid
    });
    await targetThread.updateThreadMessage();
    await next();
  });

module.exports = router;