-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: sheduling_db
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `schedule_events`
--

DROP TABLE IF EXISTS `schedule_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `program` varchar(255) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `purpose` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `category_id` int DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `participants` text NOT NULL,
  `department` text NOT NULL,
  `status` enum('active','ended','upcoming') DEFAULT 'upcoming',
  `created_by` varchar(255) DEFAULT NULL,
  `notified` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=216 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_events`
--

LOCK TABLES `schedule_events` WRITE;
/*!40000 ALTER TABLE `schedule_events` DISABLE KEYS */;
INSERT INTO `schedule_events` VALUES (204,'gg','2025-07-17','2025-07-17','gg','2025-07-15 15:56:25',NULL,'14:00:00','15:00:00','[\"secret\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',0),(205,'gg','2025-07-17','2025-07-17','gg','2025-07-15 15:57:09',NULL,'14:00:00','15:00:00','[\"GGGG\",\"banna\",\"dfdsdfsddssssf\",\"dffggffgfgdfdgddddghd\",\"shjkhsjkhjkshjhshhsjhjhkjkshkshjkhsjhjks\",\"kokey\",\"hjkhkhjkhjkhkjjhkjkjkljlkjl\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',0),(206,'meeting','2025-07-15','2025-07-15','gg','2025-07-15 16:06:44',NULL,'14:00:00','15:00:00','[\"GGGG\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',0),(207,'meeting','2025-07-17','2025-07-17','ff','2025-07-15 16:07:29',NULL,'19:00:00','20:00:00','[\"GGGG\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',1),(208,'meeting','2025-07-17','2025-07-17','ff','2025-07-15 16:08:26',NULL,'20:00:00','21:00:00','[\"GGGG\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',1),(210,'SECRET AKO LANG ANG MAY ALA,','2025-07-17','2025-07-17','okay','2025-07-17 11:38:09',NULL,'22:00:00','23:00:00','[\"ACOSTA\"]','[\"CID\"]','ended','arbgaliza@gmail.com',1),(211,'SECRET AKO LANG ANG MAY ALA,','2025-07-22','2025-07-22','gg','2025-07-22 12:35:53',NULL,'20:40:00','22:00:00','[\"secret\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',1),(212,'SECRET AKO LANG ANG MAY ALA,','2025-07-23','2025-07-23','gg','2025-07-23 06:17:34',NULL,'15:00:00','16:00:00','[\"ACOSTA\"]','[\"CID\"]','ended','Admin@gmail.com',1),(213,'meeting','2025-07-23','2025-07-23','FF','2025-07-23 06:19:10',NULL,'15:00:00','16:00:00','[\"GGGG\"]','[\"SGOD\"]','ended','arbgaliza@gmail.com',1),(214,'SECRET AKO LANG ANG MAY ALA,','2025-07-23','2025-07-23','gg','2025-07-23 06:21:20',NULL,'15:00:00','16:00:00','[\"banna\"]','[\"CID\"]','ended','arvir@gmail.com',1),(215,'meeting','2025-08-01','2025-08-01','gg','2025-08-01 02:08:49',NULL,'11:00:00','12:00:00','[\"secret\"]','[\"SGOD\"]','upcoming','arbgaliza@gmail.com',1);
/*!40000 ALTER TABLE `schedule_events` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-05 17:53:07
