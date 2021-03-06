const { gql } = require('apollo-server');

module.exports = gql`
	type User {
		id: ID!
		email: String!
		username: String!
		token: String!
		picture_url: String
		social: [String]
		projects: [Project]
	}

	type Project {
		id: ID!
		title: String!
		content: String!
		updated: String!
		screen: [String]
		owner: User!
	}

	input RegisterInput {
		username: String!
		email: String!
		password: String!
		confirmPassword: String!
	}

	type Query {
		allUsers: [User]
		getProjects: [Project]
		getProject(projectId: ID!): Project
		oauthLoginUrl: [String]
	}

	type Mutation {
		register(registerInput: RegisterInput): User!
		login(email: String!, password: String!): User!
		authorizeWithGithub(code: String!): User!
		authorizeWithGoogle(code: String!): User!
		createProject(title: String!, content: String): Project!
		deleteProject(projectId: ID!): String
		likeProject(projectId: ID!): Project!
	}

	type Subscription {
		newProject: Project!
	}
`;

// user: User!

// authorizeWithGoogle(code: String): AuthPayload
