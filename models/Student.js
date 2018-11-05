var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var Student = new Schema({
    card: {
        type: String,
        required: true,
        unique: true
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    grade: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("students", Student);
