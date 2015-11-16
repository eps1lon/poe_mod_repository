<?php

$db = new mysqli("localhost", "root", "select11", "poe");

foreach (glob("*.sql") as $query_file) {
    $query = file_get_contents($query_file);
    
    $resultset = [];
    $result = $db->query($query);
    
    while($row = $result->fetch_assoc()) {
        $resultset[$row["Rows"]] = $row;
    }
    
    file_put_contents(basename($query_file, ".sql") . ".json", json_encode($resultset));
}