const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;

  Post.find()
    .countDocuments()
    .then((count) => {
      totalItems = count;
      return Post.find()
        .skip((currentPage - 1) * perPage) // remove (currentPage - 1) * perPage documents before, so it also means get the document whose index (currentPage - 1) * perPage
        .limit(perPage);
    })
    .then((posts) => {
      res.status(200).json({
        message: "Fetched posts successfully",
        posts: posts,
        totalItems: totalItems,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500; // Server error
      }
      next(err);
    });
};

exports.createPost = (req, res, next) => {
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
  let creator;
  // Create a new post in db
  const post = new Post({
    title: title,
    imageUrl: imageUrl,
    content: content,
    creator: req.userId,
  });

  post
    .save()
    .then(() => {
      return User.findById(req.userId); // find the user who is attached to the token
    })
    .then((user) => {
      // Here we have an authenticated user who has his/her posts
      creator = user
      user.posts.push(post)
      return user.save()
    })
    .then(result => {
      res.status(201).json({
        message: "Create a new post successfully",
        post: post,
        creator: {
          _id : creator._id,
          name: creator.name
        }
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500; // Server error
      }
      next(err); // go and reach the next error handling express middleware
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("No post found !!!");
        error.statusCode = 422;
        throw error;
      }
      res
        .status(200)
        .json({ message: "Post fetched successfully !!!", post: post });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500; // Server error
      }
      next(err);
    });
};

exports.updatePost = (req, res, next) => {
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

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("No post found !!!");
        error.statusCode = 404;
        throw error;
      }
      if (post.creator.toString() !== req.userId){
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
      return post.save();
    })
    .then((result) => {
      res.status(201).json({ message: "Updated successfully", post: result });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500; // Server error
      }
      next(err);
    });
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("No post found !!!");
        error.statusCode = 422;
        throw error;
      }
      if (post.creator.toString() !== req.userId){
        const error = new Error("Not authenticated");
        error.statusCode = 403;
        throw error;
      }
      clearImage(post.imageUrl);
      return Post.findByIdAndRemove(postId);
    })
    .then((result) => {
      return User.findById(req.userId)
    })
    .then(user => {
      user.posts.pull(postId) // pull relation after deleting
      return user.save()
    })
    .then(user => {
      res
        .status(200)
        .json({ message: "Deleted Successfully !!!"});
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500; // Server error
      }
      next(err);
    });
};

const clearImage = (filePath) => {
  // we are in controller folder, so we need to jump out of that by using '..'
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
