<?php
$meta_file_encoding = 'UTF-16LE';
$script_encoding = 'UTF-8'; // encoding of PHP_script

header("Content-Type: text/plain; charset=$script_encoding");

require_once dirname(__FILE__) . '/db.php';

define("TEMP_DIR", dirname(__FILE__) . "/temp");
define("GGPK_DIR", "C:/Development/src/ggpk/poe/2.2.1e");

$db = new mysqli(MYSQL_HOST, MYSQL_USER, MYSQL_PW, MYSQL_DB);

$tags = [];
$tag_result = $db->query("SELECT Rows, Id FROM tags");
while ($tag = $tag_result->fetch_assoc()) {
    $tags[$tag['Id']] = (int)$tag['Rows'];
}

function glob_recursive($pattern, $flags = 0) {
    $files = glob($pattern, $flags);
    foreach (glob(dirname($pattern).'/*', GLOB_ONLYDIR|GLOB_NOSORT) as $dir) {
        $files = array_merge($files, glob_recursive($dir.'/'.basename($pattern), $flags));
    }
    return $files;
}

function tags($class, $class_data) {
    $tags = [];
    
    foreach (inheritance($class, $class_data) as $super_class) {
        
        if (isset($class_data[$super_class]['Base'])) {
            $super = $class_data[$super_class]['Base'];
        } else {
            $super = [];
        }
        
        
        if (!isset($super['tag'])) {
            $super['tag'] = [];
        }
        if (!isset($super['remove_tag'])) {
            $super['remove_tag'] = [];
        }
        
        $tags = array_diff(array_merge($tags, $super['tag']), $super['remove_tag']);
    }
    
    return $tags;
}

function inheritance($class, $class_data) {
    $extend_chain = [];
    
    do {
        $extend_chain[] = $class;
        
        $class = $class_data[$class]['extends'];
    } while ($class && $class !== 'nothing');
    
    return array_reverse($extend_chain);
}

$classes = [];
foreach (glob_recursive(GGPK_DIR . "/MetaData/Items/*.ot") as $meta_file) {
    $meta = mb_convert_encoding(file_get_contents($meta_file), $script_encoding, $meta_file_encoding);
    
    if (!preg_match('/extends "Metadata\/Items\/([\/\w]+)"/', $meta, $extends)) {
        $extends = [
            1 => "nothing"
        ];
    }
    
    $class_data = [
        "extends" => basename($extends[1], ".ot")
    ];
    
    preg_match_all("/(\w+)\s+\{([^}]+)\s+\}/m", $meta, $fascades);
    #print_r($fascades);
    
    foreach ($fascades[1] as $i => $fascade) {
        $class_data[$fascade] = [];
        
        #echo $fascades[2][$i];
        preg_match_all("/(\w+) = (.+)$/m", $fascades[2][$i], $properties);
        #print_r($properties);
        
        foreach ($properties[1] as $j => $prop) {
            if (!isset($class_data[$fascade][$prop])) {
                $class_data[$fascade][$prop] = [];
            } 
            
            if ($properties[2][$j][0] === '"') {
                $properties[2][$j] = substr($properties[2][$j], 1, count($properties[2][$j]) - 3);
            }
            
            $class_data[$fascade][$prop][] = $properties[2][$j];
        }
    }
    
    /*
    
    
    foreach (["tag", "remove_tag"] as $token) {
        $class_data[$token] = [];
        preg_match_all("/$token = \"(\w+)\"/", $meta, $token_matches);
        
        foreach ($token_matches[1] as $token_value) {
            $class_data[$token][] = $token_value;
        }
    }//*/

    $classes[basename($meta_file, ".ot")] = $class_data;
    
    #break;
}

foreach ($classes as $class => &$class_data) {
    $class_data['inheritance'] = inheritance($class, $classes);
    $class_data['tags'] = array_map(function ($tag) use ($tags) {
        return $tags[$tag];
    }, tags($class, $classes));
}

#print_r($classes);
file_put_contents(TEMP_DIR . "/meta_data.json", json_encode($classes));