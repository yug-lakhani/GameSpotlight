package com.gamestore.game.repository;

import com.gamestore.game.entity.Game;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameRepository extends MongoRepository<Game, String> {
    List<Game> findByTitleContainingIgnoreCase(String title);
    List<Game> findByGenre(String genre);
    List<Game> findByDeveloper(String developer);
    List<Game> findByDeveloperIgnoreCase(String developer);
}
