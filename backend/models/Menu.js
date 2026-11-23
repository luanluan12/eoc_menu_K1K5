const mongoose = require("mongoose");

// =========================
// Dish Schema
// =========================

const dishSchema = new mongoose.Schema({

    name: {

        type: String,

        required: true,

        trim: true

    },

    nameEn: {

    type: String,

    default: "",

    trim: true

},

    image: {

        type: String,

        default: ""

    },

    imagePublicId: {

    type: String,

    default: ""

},

    type: {

        type: String,

        enum: [

            "normal",

            "vegetarian",

            "drink",

            "soup",

            "dessert"

        ],

        required: true

    },vegetarian: {
    type: Boolean,
    default: false
},
subtitle: {
    type: String,
    default: "",
    trim: true
},
subtitleEn: {

    type: String,

    default: "",

    trim: true

},


}, {

    _id: true

});

// =========================
// Day Menu
// =========================

const dayMenuSchema = new mongoose.Schema({

    date: {

        type: Date,

        required: true

    },

    orderingClosed: {

        type: Boolean,

        default: false

    },

    mains: {

        type: [dishSchema],

        default: []

    },

    drinks: {

        type: [dishSchema],

        default: []

    },

    soups: {

        type: [dishSchema],

        default: []

    },

    desserts: {

        type: [dishSchema],

        default: []

    },

    meals: {
        type: mongoose.Schema.Types.Mixed,
    }

}, {

    _id: true

});

// =========================
// Week Menu
// =========================

const menuSchema = new mongoose.Schema({

    week: {

        type: String,

        required: true,

        trim: true

    },

    year: {

        type: Number,

        required: true

    },

    status: {

        type: String,

        enum: [

            "draft",

            "published",

            "closed"

        ],

        default: "draft"

    },

    guestType: {
        type: String,
        enum: ["employee", "expert"],
        default: "employee",
        required: true,
    },

    days: {

        type: [dayMenuSchema],

        validate: {

            validator(value) {

                return value.length === 5 || value.length === 6;

            },

            message: "Menu phải có 5 hoặc 6 ngày."

        }

    },
    openTime: {
    type: Date,
    required: true
},
    deadline: {

    type: Date,

    required: true

},


}, {

    timestamps: true

});

menuSchema.index({ week: 1, guestType: 1 }, { unique: true });

module.exports = mongoose.model(

    "Menu",

    menuSchema

);
