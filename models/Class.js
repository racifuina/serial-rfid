var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var Class = new Schema({
    name: {
        type: String,
        required: true,
    },
    teacher: {
        type: String,
        required: true,
    },
    time: {
        type: String,
        required: true,
        unique: true,
    },
    class: {
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

module.exports = mongoose.model("classes", Class);
