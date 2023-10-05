const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt : -1 })
      .skip((currentPage - 1) * perPage) // remove (currentPage - 1) * perPage documents before, so it also means get the document whose index (currentPage - 1) * perPage
      .limit(perPage);

    res.status(200).json({
      message: "Fetched posts successfully",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500; // Server error
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  // console.log(errors);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect");
    error.statusCode = 422;
    throw error;
  }
  if (!req.file) {
    const error = new Error("No image provided");
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path.replace("\\", "/");
  console.log(imageUrl);
  const title = req.body.title;
  const content = req.body.content;
  // Create a new post in db
  const post = new Post({
    title: title,
    imageUrl: imageUrl,
    content: content,
    creator: req.userId,
  });
  try {
    await post.save();
    const user = await User.findById(req.userId); // find the user who is attached to the token
    // Here we have an authenticated user who has his/her posts
    user.posts.push(post);
    await user.save();
    // event name : posts and the object with action or post depend on you, it is not forced by socket.io
    io.getIO().emit("posts", {
      action: "create",
      // post : post // we missing the creator name
      post: {
        ...post.toObject(),
        creator: { _id: req.userId, name: user.name },
      },
    });
    res.status(201).json({
      message: "Create a new post successfully",
      post: post,
      creator: {
        _id: user._id,
        name: user.name,
      },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500; // Server error
    }
    next(err); // go and reach the next error handling express middleware
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  const post = await Post.findById(postId).populate("creator");
  try {
    if (!post) {
      const error = new Error("No post found !!!");
      error.statusCode = 422;
      throw error;
    }
    res
      .status(200)
      .json({ message: "Post fetched successfully !!!", post: post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500; // Server error
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);
  // console.log(errors);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect");
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }
  if (!imageUrl) {
    const error = new Error("No file picked");
    error.statusCode = 422;
    throw error;
  }

  const post = await Post.findById(postId).populate("creator");
  try {
    if (!post) {
      const error = new Error("No post found !!!");
      error.statusCode = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authenticated");
      error.statusCode = 403;
      throw error;
    }
    if (imageUrl !== post.imageUrl) {
      console.log("No duplicate image, please replace");
      clearImage(post.imageUrl);
    }
    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const result = await post.save();
    io.getIO().emit("posts", { action: "update", post: result });
    res.status(201).json({ message: "Updated successfully", post: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500; // Server error
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("No post found !!!");
      error.statusCode = 422;
      throw error;
    }
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authenticated");
      error.statusCode = 403;
      throw error;
    }
    clearImage(post.imageUrl);
    await Post.findByIdAndRemove(postId);
    const user = await User.findById(req.userId);
    user.posts.pull(postId); // pull relation after deleting
    await user.save();
    io.getIO().emit('posts', { action : 'delete', post: postId})
    res.status(200).json({ message: "Deleted Successfully !!!" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500; // Server error
    }
    next(err);
  }
};

const clearImage = (filePath) => {
  // we are in controller folder, so we need to jump out of that by using '..'
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
