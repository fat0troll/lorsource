/*
 * Copyright 1998-2026 Linux.org.ru
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */
package ru.org.linux.user

import com.typesafe.scalalogging.StrictLogging
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.scala.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

import javax.sql.DataSource
import scala.jdk.CollectionConverters.*

@Repository
class UserTagDao(ds: DataSource) extends StrictLogging {
  private val jdbcTemplate = new JdbcTemplate(ds)
  private val namedJdbcTemplate = new NamedParameterJdbcTemplate(ds)

  /**
   * Добавление тега к пользователю.
   *
   * @param userId     идентификационный номер пользователя
   * @param tagId      идентификационный номер тега
   * @param isFavorite выбирать фаворитные теги (true) или игнорируемые (false)
   */
  def addTag(userId: Int, tagId: Int, isFavorite: Boolean): Unit = {
    val parameters = Map[String, Any](
      "user_id" -> userId,
      "tag_id" -> tagId,
      "is_favorite" -> isFavorite
    )

    try {
      namedJdbcTemplate.update(
        "INSERT INTO user_tags (user_id, tag_id, is_favorite) VALUES(:user_id, :tag_id, :is_favorite)",
        parameters.asJava
      )
    } catch {
      case ex: DuplicateKeyException =>
        logger.debug("Tag already added to favs", ex)
    }
  }

  /**
   * Удаление тега у пользователя.
   *
   * @param userId     идентификационный номер пользователя
   * @param tagId      идентификационный номер тега
   * @param isFavorite выбирать фаворитные теги (true) или игнорируемые (false)
   */
  def deleteTag(userId: Int, tagId: Int, isFavorite: Boolean): Unit = {
    val parameters = Map[String, Any](
      "user_id" -> userId,
      "tag_id" -> tagId,
      "is_favorite" -> isFavorite
    )

    namedJdbcTemplate.update(
      "DELETE FROM user_tags WHERE user_id=:user_id and tag_id=:tag_id and is_favorite=:is_favorite",
      parameters.asJava
    )
  }

  /**
   * Удаление тега у всех пользователей.
   *
   * @param tagId идентификационный номер тега
   */
  def deleteTags(tagId: Int): Unit = {
    val parameters = Map[String, Any](
      "tag_id" -> tagId
    )

    namedJdbcTemplate.update("DELETE FROM user_tags WHERE tag_id=:tag_id", parameters.asJava)
  }

  /**
   * Получить список всех тегов для пользователя.
   *
   * @param userId     идентификационный номер пользователя
   * @param isFavorite выбирать фаворитные теги (true) или игнорируемые (false)
   * @return список тегов пользователя
   */
  def getTags(userId: Int, isFavorite: Boolean): List[String] = {
    val parameters = Map[String, Any](
      "user_id" -> userId,
      "is_favorite" -> isFavorite
    )

    namedJdbcTemplate.query(
      "SELECT tags_values.value FROM user_tags, tags_values WHERE " +
        "user_tags.user_id=:user_id AND tags_values.id=user_tags.tag_id AND user_tags.is_favorite=:is_favorite " +
        "ORDER BY value",
      parameters.asJava,
      (rs, _) => rs.getString("value")
    ).asScala.toList
  }

  /**
   * Получить список ID пользователей, у которых в профиле есть перечисленные фаворитные теги.
   *
   * @param userId идентификационный номер пользователя, которому не нужно слать оповещение
   * @param tags   список фаворитных тегов
   * @return список ID пользователей
   */
  def getUserIdListByTags(userId: Int, tags: Seq[Int]): List[Int] = {
    if (tags.isEmpty) {
      List.empty
    } else {
      val parameters = Map[String, Any](
        "values" -> tags.asJava,
        "user_id" -> userId
      )

      namedJdbcTemplate.queryForList(
        "select distinct user_id from user_tags where tag_id in (:values) " +
          "AND is_favorite = true " +
          "AND user_id not in (" +
          "select userid from ignore_list where ignored=:user_id union " +
          "select :user_id union " +
          "select user_id from user_tags where tag_id in (:values) and is_favorite = false)",
        parameters.asJava,
        classOf[Integer]
      ).asScala.map(_.intValue()).toList
    }
  }

  /**
   * Замена тега у пользователей другим тегом.
   *
   * @param oldTagId идентификационный номер старого тега
   * @param newTagId идентификационный номер нового тега
   */
  def replaceTag(oldTagId: Int, newTagId: Int): Unit = {
    val parameters = Map[String, Any](
      "new_tag_id" -> newTagId,
      "old_tag_id" -> oldTagId
    )

    namedJdbcTemplate.update(
      "UPDATE user_tags SET tag_id=:new_tag_id WHERE tag_id=:old_tag_id " +
        "AND user_id NOT IN (SELECT user_id FROM user_tags WHERE tag_id=:new_tag_id)",
      parameters.asJava
    )
  }

  /**
   * Показывает количество пользователей у которых тег в избранном
   *
   * @param tagId
   * @return
   */
  def countFavs(tagId: Int): Int = {
    val count: Integer = namedJdbcTemplate.queryForObject(
      "SELECT count(*) FROM user_tags WHERE tag_id=:tagId AND is_favorite",
      Map("tagId" -> tagId).asJava,
      classOf[Integer]
    )
    count
  }

  def countIgnore(tagId: Int): Int = {
    val count: Integer = namedJdbcTemplate.queryForObject(
      "SELECT count(*) FROM user_tags WHERE tag_id=:tagId AND NOT is_favorite",
      Map("tagId" -> tagId).asJava,
      classOf[Integer]
    )
    count
  }

  def deleteUnusedTags(): Int = {
    jdbcTemplate.update("delete from user_tags where not exists " +
      "(select * from tags join topics on topics.id=tags.msgid where tagid=user_tags.tag_id and not deleted)")
  }
}