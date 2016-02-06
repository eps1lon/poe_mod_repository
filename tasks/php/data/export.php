<?php
require_once dirname(__FILE__) . '/../db.php';

define("TEMP_DIR", dirname(__FILE__) . '/../temp/data');

$db = new mysqli(MYSQL_HOST, MYSQL_USER, MYSQL_PW, MYSQL_DB);

foreach (glob("*.sql") as $query_file) {
    $query = file_get_contents($query_file);
    
    $resultset = [];
    $result = $db->query($query) or die($db->error);
    
    $json_options = 0;
    
    while($row = $result->fetch_assoc()) {
        if (isset($row['init_mode'])) {
            if ($row['init_mode'] === 'init_empty_string') {
                $resultset[$row["primary"]] = "";
            }
        } else {
            $resultset[$row["primary"]] = $row;
        }
        if (isset($row['json_options'])) {
            $json_options = $row['json_options'];
        }
    }
    
    file_put_contents(TEMP_DIR . "/" . basename($query_file, ".sql") . ".json", json_encode($resultset, (int)$json_options));
}