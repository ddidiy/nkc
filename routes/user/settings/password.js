const Router = require('koa-router');
const passwordRouter = new Router();
passwordRouter
	.get('/', async (ctx, next) => {
		ctx.template = 'interface_user_settings_password.pug';
		await next();
	})
	.patch('/', async (ctx, next) => {
		const {data, db, body} = ctx;
		const {oldPassword, password} = body;
		if(!oldPassword) ctx.throw(400, '旧密码不能为空');
		if(!password) ctx.throw(400, '新密码不能为空');
		const {apiFunction} = ctx.nkcModules;
		const {user} = data;
		const userPersonal = await db.UsersPersonalModel.findOnly({uid: user.uid});
		if(!apiFunction.testPassword(oldPassword, userPersonal.hashType, userPersonal.password)) {
			ctx.throw(400, '旧密码错误');
		}
		const {contentLength, checkPass} = ctx.tools.checkString;
		if(contentLength(password) < 8) ctx.throw(400, '密码长度不能小于8位');
		if(!checkPass(password)) ctx.throw(400, '密码要具有数字、字母和符号三者中的至少两者');
		const newPassword = apiFunction.newPasswordObject(password);
		const newSecretBehavior = db.SecretBehaviorModel({
			uid: user.uid,
			type: 'changePassword',
			ip: ctx.address,
			port: ctx.port,
			oldHashType: userPersonal.hashType,
			oldHash: userPersonal.password.hash,
			oldSalt: userPersonal.password.salt,
			newHashType: newPassword.hashType,
			newHash: newPassword.password.hash,
			newSalt: newPassword.password.salt
		});
		await userPersonal.update({password: newPassword.password, hashType: newPassword.hashType});
		await newSecretBehavior.save();
		await next();
	});
module.exports = passwordRouter;