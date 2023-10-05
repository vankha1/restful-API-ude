const bcrypt = require("bcryptjs");
const validator = require("validator");

const User = require("../models/user");

module.exports = {
  createUser: async function (args, req) {
    const errors = [];
    if (!validator.isEmail(args.userInput.email)) {
      errors.push({ message: "Invalid email address" });
    }
    if (
      validator.isEmail(args.userInput.email) ||
      !validator.isLength(args.userInput.password, { min: 5 })
    ) {
      errors.push({ messgage: "Password too short" });
    }

    if (errors.length > 0){
        const error = new Error('Invalid input')
        error.data = errors
        error.code = 422
        throw error
    }

    // we can use destructoring {userInput} instead passing entire object args
    const existingUser = await User.findOne({ email: args.userInput.email });

    if (existingUser) {
      const error = new Error("User already exists");
      throw error;
    }

    const hashedPassword = await bcrypt.hash(args.userInput.password, 12);
    const user = new User({
      email: args.userInput.email,
      name: args.userInput.name,
      password: hashedPassword,
    });

    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() }; // _id is used to override the id of _doc
  },
};
