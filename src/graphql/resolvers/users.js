const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserInputError } = require('apollo-server');
// util
const {
	validateRegisterInput,
	validateLoginInput,
} = require('../../util/validators');
// dotenv
const dotenv = require('dotenv');
dotenv.config();
// google oauth
const { google } = require('googleapis');
// fetch
const fetch = require('cross-fetch');
// model
const User = require('../../db/models/User');

// TODO: login or Register. create Token. server-resolvers 단계에서 인증관리
const generateToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			username: user.username,
		},
		process.env.SECRET_KEY,
		{ expiresIn: '1h' }
	);
};

// google oauth
const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	'http://localhost:4000/google/callback'
);

module.exports = {
	Query: {
		allUsers: async () => {
			try {
				const users = await User.find();
				return users;
			} catch (err) {
				throw new Error(err);
			}
		},
		oauthLoginUrl: () => {
			const scopes = [
				'https://www.googleapis.com/auth/userinfo.profile',
				'https://www.googleapis.com/auth/userinfo.email',
			];

			const googleUrl = oauth2Client.generateAuthUrl({
				access_type: 'offline',
				scope: scopes,
			});

			const githubUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user&redirect_uri=http%3A//localhost:4000/github/callback`;

			return [googleUrl, githubUrl];
		},
	},
	Mutation: {
		login: async (_, { email, password }) => {
			const { errors, valid } = validateLoginInput(email, password);

			//* valid: Object.keys(errors).length < 1 ==> error 유무판단, 없으면 true
			if (!valid) {
				throw new UserInputError('Errors', { errors });
			}

			const user = await User.findOne({ email });
			if (!user) {
				throw new UserInputError('User not found', {
					errors: {
						email: 'User not found',
					},
				});
			}

			const match = await bcrypt.compare(password, user.password);
			if (!match) {
				throw new UserInputError('Wrong credentials', {
					errors: {
						password: 'Wrong credentials',
					},
				});
			}

			const token = generateToken(user);

			return {
				...user._doc,
				id: user._id,
				token,
			};
		},
		register: async (
			_,
			{ registerInput: { username, email, password, confirmPassword } }
		) => {
			// TODO : Validate user data
			const { valid, errors } = validateRegisterInput(
				username,
				email,
				password,
				confirmPassword
			);

			//* valid: Object.keys(errors).length < 1 ==> error 유무판단, 없으면 true
			if (!valid) {
				throw new UserInputError('Errors', { errors });
			}
			// TODO: Make sure user doesn't already exist. 동명이인이 있을수있으니 email로 체크
			const user = await User.findOne({ email });
			if (user) {
				throw new UserInputError('email is taken', {
					errors: {
						email: 'This email is taken',
					},
				});
			}

			// TODO: Hash password
			password = await bcrypt.hash(password, 12);

			const newUser = new User({
				email,
				password,
				username,
				createdAt: new Date().toISOString(),
			});

			// TODO: Save the user
			const res = await newUser.save();

			// TODO: Create login token
			const token = generateToken(res);

			// TODO: 새로운 user의 정보반환. res(email, password, username), id, token
			return {
				...res._doc,
				id: res._id,
				token,
			};
		},

		authorizeWithGithub: async (_, { code }) => {
			const tokenRes = await fetch(
				'https://github.com/login/oauth/access_token',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({
						client_id: process.env.GITHUB_CLIENT_ID,
						client_secret: process.env.GITHUB_CLIENT_SECRET,
						code,
					}),
				}
			);

			const tokenData = await tokenRes.json();

			const userRes = await fetch(
				`https://api.github.com/user?access_token=${tokenData.access_token}`
			);

			const userData = await userRes.json();

			const currentUser = {
				username: userData.name,
				email: userData.email,
				picture_url: userData.avatar_url,
				// social: {
				// 	github: userData.html_url,
				// },
			};

			// todo: Oauth로 접속한 user가 회원가입하지 않은 사람이라면?
			// todo: 자동으로 회원가입을 하고
			// todo: 이미 가입한 회원이라면 회원 정보를 가져다 준다.

			const user = await User.findOne({ email: currentUser.email });
			console.log(user);

			if (user) {
				const token = generateToken(user);
				console.log({
					...user._doc,
					id: user._id,
					picture_url: currentUser.picture_url,
					token,
				});
				return {
					...user._doc,
					id: user._id,
					picture_url: currentUser.picture_url,
					social: currentUser.social,
					token,
				};
			} else {
				const newUser = new User({
					email: currentUser.email,
					username: currentUser.username,
					picture_url: currentUser.picture_url,
					social: currentUser.social,
				});

				// TODO: Save the user
				const res = await newUser.save();

				const token = generateToken(res);

				// TODO: 새로운 user의 정보반환. res(email, password, username), id, token
				return {
					...res._doc,
					id: res._id,
					token,
				};
			}
		},

		authorizeWithGoogle: async (_, { code }) => {
			// todo : access_token, refresh_token, scope, token_type, expiry_date
			const { tokens } = await oauth2Client.getToken(decodeURIComponent(code));

			// oauth2Client.setCredentials(tokens);

			// todo : user 정보 가져오기
			const userRes = await fetch(
				`https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${tokens.access_token}`
			);

			const userData = await userRes.json();

			const currentUser = {
				username: userData.name,
				email: userData.email,
				picture_url: userData.picture,
			};

			// todo: Oauth로 접속한 user가 회원가입하지 않은 사람이라면?
			// todo: 자동으로 회원가입을 하고
			// todo: 이미 가입한 회원이라면 회원 정보를 가져다 준다.

			const user = await User.findOne({ email: currentUser.email });

			if (user) {
				const token = generateToken(user);
				return {
					...user._doc,
					id: user._id,
					picture_url: currentUser.picture_url,
					social: user.social,
					token,
				};
			} else {
				const newUser = new User({
					email: currentUser.email,
					username: currentUser.username,
					picture_url: currentUser.picture_url,
				});

				// TODO: Save the user
				const res = await newUser.save();
				const token = generateToken(res);

				// TODO: 새로운 user의 정보반환. res(email, password, username), id, token
				return {
					...res._doc,
					id: res._id,
					token,
				};
			}
		},
	},
};
