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

package ru.org.linux.comment

import org.springframework.dao.EmptyResultDataAccessException
import org.springframework.scala.jdbc.core.JdbcTemplate
import org.springframework.scala.transaction.support.TransactionManagement
import org.springframework.stereotype.Repository
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import ru.org.linux.site.MessageNotFoundException
import ru.org.linux.user.User
import ru.org.linux.util.StringUtil

import java.sql.{PreparedStatement, Timestamp, Types}
import javax.sql.DataSource

/**
 * Операции над комментариями
 */
@Repository
class CommentDao(dataSource: DataSource, val transactionManager: PlatformTransactionManager) extends TransactionManagement {
  private val jdbcTemplate = new JdbcTemplate(dataSource)

  private val queryCommentById =
    "SELECT " +
      "postdate, topic, userid, comments.id as msgid, comments.title, " +
      "deleted, replyto, edit_count, edit_date, editor_id, " +
      "ua_id, comments.postip, comments.reactions " +
      "FROM comments " +
      "WHERE comments.id=?"

  /**
   * Запрос списка комментариев для топика ВКЛЮЧАЯ удаленные
   */
  private val queryCommentListByTopicId =
    "SELECT " +
      "comments.title, topic, postdate, userid, comments.id as msgid, " +
      "replyto, edit_count, edit_date, editor_id, deleted, " +
      "ua_id, comments.postip, comments.reactions " +
      "FROM comments " +
      "WHERE topic=? ORDER BY msgid ASC"

  /**
   * Запрос списка комментариев для топика ИСКЛЮЧАЯ удаленные
   */
  private val queryCommentListByTopicIdWithoutDeleted =
    "SELECT " +
      "comments.title, topic, postdate, userid, comments.id as msgid, " +
      "replyto, edit_count, edit_date, editor_id, deleted, " +
      "ua_id, comments.postip, comments.reactions " +
      "FROM comments " +
      "WHERE topic=?  AND NOT deleted ORDER BY msgid ASC"

  private val replysForCommentCount = "SELECT count(id) FROM comments WHERE replyto=? AND NOT deleted"
  private val deleteCommentSql = "UPDATE comments SET deleted='t' WHERE id=? AND not deleted"

  /**
   * Получить комментарий по id
   *
   * @param id id нужного комментария
   * @return нужный комментарий
   * @throws MessageNotFoundException при отсутствии сообщения
   */
  @throws[MessageNotFoundException]
  def getById(id: Int): Comment = {
    try {
      jdbcTemplate.queryForObjectAndMap(queryCommentById, id)((rs, _) => Comment(rs)).orNull
    } catch {
      case _: EmptyResultDataAccessException =>
        throw new MessageNotFoundException(id)
    }
  }

  /**
   * Список комментариев топика
   *
   * @param topicId     id топика
   * @param showDeleted вместе с удаленными
   * @return список комментариев топика
   */
  def getCommentList(topicId: Int, showDeleted: Boolean): Seq[Comment] =
    if (showDeleted) {
      jdbcTemplate.queryAndMap(queryCommentListByTopicId, topicId)((rs, _) => Comment.apply(rs))
    } else {
      jdbcTemplate.queryAndMap(queryCommentListByTopicIdWithoutDeleted, topicId)((rs, _) => Comment.apply(rs))
    }

  /**
   * Удалить комментарий.
   *
   * @param msgid идентификационнай номер комментария
   * @return true если комментарий был удалён, иначе false
   */
  def deleteComment(msgid: Int): Boolean =
    jdbcTemplate.update(deleteCommentSql, msgid) > 0

  def undeleteComment(comment: Comment): Unit =
    transactional(propagation = Propagation.MANDATORY) { _ =>
      jdbcTemplate.update("UPDATE comments SET deleted='f' WHERE id=?", comment.id)
    }

  /**
   * Обновляет статистику после удаления комментариев в одном топике.
   *
   * @param commentId идентификатор любого из удаленных комментариев (обычно корневой в цепочке)
   * @param count     количество удаленных комментариев
   */
  def updateStatsAfterDelete(commentId: Int, count: Int): Unit = {
    val topicId = jdbcTemplate.queryForObject[Int]("SELECT topic FROM comments WHERE id=?", commentId).get

    jdbcTemplate.update("UPDATE topics SET stat1=stat1-?, lastmod=CURRENT_TIMESTAMP WHERE id = ?", count, topicId)
    jdbcTemplate.update("UPDATE topics SET stat3=stat1 WHERE id=? AND stat3 > stat1", topicId)
  }

  /**
   * Сколько ответов на комментарий
   *
   * @param msgid id комментария
   * @return число ответов на комментарий
   */
  def getRepliesCount(msgid: Int): Int =
    jdbcTemplate.queryForObject[Int](replysForCommentCount, msgid).get

  /**
   * Массовое удаление комментариев пользователя со всеми ответами на комментарии.
   *
   * @param user пользователь для экзекуции
   * @return список удаленных комментариев
   */
  def getAllByUserForUpdate(user: User): Seq[Int] =
    transactional(propagation = Propagation.MANDATORY) { _ =>
      jdbcTemplate.queryForSeq[Int]("SELECT id FROM comments WHERE userid=? AND not deleted ORDER BY id DESC FOR update",
        user.id)
    }

  def getCommentsByIPAddressForUpdate(ip: String, timedelta: Timestamp): Seq[Int] =
    transactional(propagation = Propagation.MANDATORY) { _ =>
      jdbcTemplate.queryForSeq[Int](
        "SELECT id FROM comments WHERE postip=?::inet AND not deleted AND postdate>? ORDER BY id DESC FOR update",
        ip, timedelta)
    }

  /**
   * Добавить новый комментарий.
   *
   * @return идентификационный номер нового комментария
   */
  def saveNewMessage(comment: Comment, userAgent: Option[String]): Int =
    transactional(propagation = Propagation.MANDATORY) { _ =>
      val msgid = jdbcTemplate.queryForObject[Int]("select nextval('s_msgid') as msgid").get

      val truncatedUserAgent = userAgent.map(ua => ua.substring(0, Math.min(511, ua.length)))

      jdbcTemplate.executePreparedStatement(
        "INSERT INTO comments (id, userid, title, postdate, replyto, deleted, topic, postip, ua_id) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'f', ?, ?::inet, create_user_agent(?))"
      ) { (pst: PreparedStatement) =>
        pst.setInt(1, msgid)
        pst.setInt(2, comment.userid)
        pst.setString(3, comment.title)

        if (comment.replyTo != 0) {
          pst.setInt(4, comment.replyTo)
        } else {
          pst.setNull(4, Types.INTEGER)
        }

        pst.setInt(5, comment.topicId)
        pst.setString(6, comment.postIP)
        pst.setString(7, truncatedUserAgent.orNull)

        pst.executeUpdate()
      }

      msgid
    }

  /**
   * Редактирование комментария.
   *
   * @param oldComment данные старого комментария
   * @param title       новый заголовок
   */
  def changeTitle(oldComment: Comment, title: String): Unit =
    jdbcTemplate.update("UPDATE comments SET title=? WHERE id=?", title, oldComment.id)

  /**
   * Обновить информацию о последнем редакторе комментария.
   *
   * @param id        идентификационный номер комментария
   * @param editorId  идентификационный номер редактора комментария
   * @param editDate  дата редактирования
   * @param editCount количество исправлений
   */
  def updateLatestEditorInfo(id: Int, editorId: Int, editDate: Timestamp, editCount: Int): Unit =
    jdbcTemplate.update(
      "UPDATE comments set editor_id = ? , edit_date = ?, edit_count = ? WHERE id = ?",
      editorId, editDate, editCount, id
    )

  /**
   * Получить список последних удалённых комментариев пользователя.
   *
   * @param userId идентификационный номер пользователя
   * @return список удалённых комментариев пользователя
   */
  def getDeletedComments(userId: Int): Seq[CommentsListItem] =
    jdbcTemplate.queryAndMap(
      "SELECT " +
        "groups.title as gtitle, topics.title, topics.id as msgid, " +
        "comdel.reason, COALESCE(comdel.delDate, topdel.delDate) deldate, comdel.bonus, " +
        "comments.id as cid, comments.postdate, topics.deleted topic_deleted, comments.deleted comment_deleted " +
        "FROM groups JOIN topics ON groups.id=topics.groupid " +
        "JOIN comments ON comments.topic=topics.id " +
        "LEFT JOIN del_info comdel ON comdel.msgid=comments.id " +
        "LEFT JOIN del_info topdel ON topdel.msgid=topics.id " +
        "WHERE comments.userid=? AND (comments.deleted OR topics.deleted) " +
        "ORDER BY COALESCE(comdel.delDate, topdel.delDate) DESC NULLS LAST, comments.id DESC LIMIT 50",
      userId
    ) { (rs, _) =>
      CommentsListItem(
        gtitle = rs.getString("gtitle"),
        msgid = rs.getInt("msgid"),
        title = StringUtil.makeTitle(rs.getString("title")),
        reason = rs.getString("reason"),
        delDate = rs.getTimestamp("deldate"),
        bonus = rs.getInt("bonus"),
        commentId = rs.getInt("cid"),
        deleted = rs.getBoolean("comment_deleted"),
        postdate = rs.getTimestamp("postdate"),
        authorId = userId,
        topicDeleted = rs.getBoolean("topic_deleted"))
    }
}