const { model, Schema } = require('mongoose');

const userSchema = new Schema({
	username: String,
	email: { type: String, required: true, index: true, unique: true },
	password: String,
	createdAt: String,
	picture_url: String,
	social: {
		github: String,
		facebook: String,
		instagram: String,
		website: String,
	},
	projects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
});

module.exports = model('User', userSchema);
