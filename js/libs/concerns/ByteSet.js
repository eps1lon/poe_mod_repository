/* global ByteSet */

(function (__undefined) {
    // todo if-exists
    this.ByteSet = Class.extend({});
    
    // TODO localize, blacklist instead of ignore
    ByteSet.human = function(byte, byte_set, ignore) {
        var strings = [];
        var bits = [];

        $.each(byte_set, function (key, bit) {
            if (byte & bit && !(byte & ignore)) {
                bits.push(bit);
                strings.push(key);
            }
        });

        return {
            strings: strings,
            bits: bits
        };
    };
})();