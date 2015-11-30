/* global Class, Serializeable */

(function (__undefined) {
    this.ModFactory = Class.extend({});
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    this.ModFactory.deserialize = Serializeable.deserialize;
})();