(function (__undefined) {
    /**
     * Interface Serializeable
     */
    this.Serializeable = Class.extend({
        serialize: function () {
            return {
                klass: "",
                args: []
            };
        }
    });
})();