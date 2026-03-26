//we did client side validations in the forms
//and now for server side validations we use a tool known as joi
//go on website joi and learn more
//joi validates schema on server side schema
//it checks all the feilds which said to be required to be present in the object
const Joi = require("joi");
module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    //    image:Joi.string().allow("",null),
    image: Joi.object({
      url: Joi.string().allow("", null),
      filename: Joi.string().allow("", null),
    }),
    price: Joi.number().required().min(0),
    location: Joi.string().required(),
    country: Joi.string().required(),
    category: Joi.string().required(),
    geometry: Joi.object({
    type: Joi.string(),
    coordinates: Joi.array().items(Joi.number()),
}),
  }).required(),
}).required();

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
}).required();
