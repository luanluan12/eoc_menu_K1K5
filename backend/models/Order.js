const mongoose = require("mongoose");

// ==========================
// Main Dish
// ==========================

const mainSelectionSchema = new mongoose.Schema({

    dishId: {

        type: mongoose.Schema.Types.ObjectId,

        required: true

    },

    name: {

        type: String,

        required: true

    },

    nameEn: { type: String, default: "" },

    image: {

        type: String,

        default: ""

    },

    quantity: {

        type: Number,

        min: 1,

        default: 1

    },

    mealPeriod: { type: String, enum: ["lunch", "dinner", ""], default: "" },

    category: { type: String, enum: ["rice", "vegetarian", "noodles", "soup", ""], default: "" }

}, {

    _id: false

});

// ==========================
// Drink / Soup
// ==========================

const singleSelectionSchema = new mongoose.Schema({

    dishId: {

        type: mongoose.Schema.Types.ObjectId,

        required: true

    },

    name: {

        type: String,

        required: true

    },

    image: {

        type: String,

        default: ""

    }

}, {

    _id: false

});

// ==========================
// Review
// ==========================

const reviewSchema = new mongoose.Schema({

    rating: {

        type: Number,

        min: 1,

        max: 10,

        required: true

    },

    comment: {

        type: String,

        trim: true,

        maxlength: 500,

        default: ""

    },

    image: {

        type: String,

        default: ""

    },

    imagePublicId: {

        type: String,

        default: ""

    },

    createdAt: {

        type: Date,

        default: Date.now

    }

}, {

    _id: false

});

// ==========================
// Order Day
// ==========================

const orderDaySchema = new mongoose.Schema({

    date: {

        type: Date,

        required: true

    },

    mains: {

        type: [mainSelectionSchema],

        default: []

    },

    drink: {

        type: singleSelectionSchema,

        default: null

    },

    soup: {

        type: singleSelectionSchema,

        default: null

    },
    received: {
    type: Boolean,
    default: false
},

review: {

    type: reviewSchema,

    default: null

},

receivedAt: {
    type: Date,
    default: null
}

}, {

    _id: false

});

// ==========================
// Order
// ==========================

const orderSchema = new mongoose.Schema({

    user: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true

    },

    menu: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Menu",

        required: true

    },

    week: {

        type: String,

        required: true

    },

    days: {

        type: [orderDaySchema],

        validate: {

            validator(value) {

                return value.length === 5 || value.length === 6;

            },

            message: "Đơn phải có 5 hoặc 6 ngày."

        }

    },

    status: {

        type: String,

        enum: [

            "ordered",

            "cancelled"

        ],

        default: "ordered"

    },
    qrToken: {
    type: String,
    default: ""
}

}, {

    timestamps: true

});

orderSchema.index(

    {

        user: 1,

        week: 1

    },

    {

        unique: true

    }

);

// Phục vụ Dashboard và danh sách order; đặt ngày trước để cả truy vấn chỉ có
// ngày lẫn truy vấn ngày + trạng thái đều dùng được index.
orderSchema.index({ "days.date": 1, status: 1 });

module.exports = mongoose.model(

    "Order",

    orderSchema

);
