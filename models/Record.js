var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var Record = new Schema({
    card: {
        type: String,
        required: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    class: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("records", Record);
