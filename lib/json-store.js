var Store = require("jfs");
var db = new Store("./tipbot-data");

function JsonStore() {

    this.save = function(key, data, cb) {
        // save with custom ID
        db.save(key, data, function(err){
            // if save failed
            if (err) {
                cb(true, null);
                return;
            }
            // now the data is stored in the file tipbot-data/<key>
            cb(null, true);
        });
    };

    this.load = function(key, cb) {
        db.get(key, function(err, obj){
            // if load failed
            if (err) {
                cb(true, null);
                return;
            }
            // load succeeded!
            cb(null, obj);
        });
    };
}

module.exports = new JsonStore();
