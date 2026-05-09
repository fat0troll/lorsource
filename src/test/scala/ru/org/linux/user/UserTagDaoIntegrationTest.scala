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

import com.google.common.collect.ImmutableMap
import org.junit.Assert.assertEquals
import org.junit.{Before, Test}
import org.junit.runner.RunWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.simple.SimpleJdbcInsert
import org.springframework.test.context.{ContextConfiguration, ContextHierarchy}
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner
import org.springframework.transaction.annotation.Transactional

import javax.sql.DataSource

object UserTagDaoIntegrationTest {
  private val QueryCountFavoriteByUser = "SELECT count(user_id) FROM user_tags WHERE is_favorite=true AND user_id=?"
  private val QueryCountIgnoreByUser = "SELECT count(user_id) FROM user_tags WHERE is_favorite=false AND user_id=?"
}

@RunWith(classOf[SpringJUnit4ClassRunner])
@ContextHierarchy(Array(
  new ContextConfiguration(value = Array("classpath:database.xml")),
  new ContextConfiguration(classes = Array(classOf[SimpleIntegrationTestConfiguration]))
))
@Transactional
class UserTagDaoIntegrationTest {
  @Autowired
  var userTagDao: UserTagDao = scala.compiletime.uninitialized

  private var jdbcTemplate: JdbcTemplate = scala.compiletime.uninitialized

  private var user1Id: Int = scala.compiletime.uninitialized
  private var user2Id: Int = scala.compiletime.uninitialized

  private var tag1Id: Int = scala.compiletime.uninitialized
  private var tag2Id: Int = scala.compiletime.uninitialized
  private var tag3Id: Int = scala.compiletime.uninitialized
  private var tag4Id: Int = scala.compiletime.uninitialized
  private var tag5Id: Int = scala.compiletime.uninitialized

  @Autowired
  def setDataSource(ds: DataSource): Unit = {
    jdbcTemplate = new JdbcTemplate(ds)
  }

  private def createUser(userName: String): Int = {
    val userid = jdbcTemplate.queryForObject("SELECT nextval('s_uid') AS userid", classOf[Integer])

    jdbcTemplate.update(
      "INSERT INTO users (id, name, nick) VALUES (?, ?, ?)",
      userid: AnyRef, userName: AnyRef, userName: AnyRef
    )
    userid
  }

  private def createTag(tagName: String): Int = {
    val insert = new SimpleJdbcInsert(jdbcTemplate)
      .withTableName("tags_values")
      .usingGeneratedKeyColumns("id")

    insert.executeAndReturnKey(ImmutableMap.of[String, AnyRef]("value", tagName)).intValue()
  }

  @Before
  def prepareTestData(): Unit = {
    user1Id = createUser("UserTagDaoIntegrationTest_user1")
    user2Id = createUser("UserTagDaoIntegrationTest_user2")

    tag1Id = createTag("UserTagDaoIntegrationTest_tag1")
    tag2Id = createTag("UserTagDaoIntegrationTest_tag2")
    tag3Id = createTag("UserTagDaoIntegrationTest_tag3")
    tag4Id = createTag("UserTagDaoIntegrationTest_tag4")
    tag5Id = createTag("UserTagDaoIntegrationTest_tag5")
  }

  private def prepareUserTags(): Unit = {
    userTagDao.addTag(user1Id, tag1Id, true)
    userTagDao.addTag(user2Id, tag1Id, true)
    userTagDao.addTag(user1Id, tag2Id, true)
    userTagDao.addTag(user1Id, tag2Id, false)
    userTagDao.addTag(user2Id, tag2Id, true)
    userTagDao.addTag(user2Id, tag3Id, true)
    userTagDao.addTag(user1Id, tag3Id, true)
    userTagDao.addTag(user2Id, tag4Id, true)
    userTagDao.addTag(user1Id, tag4Id, true)
    userTagDao.addTag(user1Id, tag5Id, false)
    userTagDao.addTag(user2Id, tag5Id, true)
    userTagDao.addTag(user1Id, tag5Id, true)
  }

  @Test
  def addTest(): Unit = {
    prepareUserTags()

    userTagDao.addTag(user1Id, tag1Id, false)

    var result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 5, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountIgnoreByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 3, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user2Id))
    assertEquals("Wrong count of user tags.", 5, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountIgnoreByUser,
      classOf[Integer], Integer.valueOf(user2Id))
    assertEquals("Wrong count of user tags.", 0, result)

    result = jdbcTemplate.queryForObject(
      "SELECT count(user_id) FROM user_tags WHERE tag_id=?",
      classOf[Integer], Integer.valueOf(tag1Id))
    assertEquals("Wrong count of user tags.", 3, result)
  }

  @Test
  def deleteOneTest(): Unit = {
    prepareUserTags()

    userTagDao.deleteTag(user1Id, tag1Id, true)
    userTagDao.deleteTag(user1Id, tag2Id, true)

    var result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 3, result)

    userTagDao.deleteTag(user1Id, tag2Id, false)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 3, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountIgnoreByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 1, result)
  }

  @Test
  def deleteAllTest(): Unit = {
    prepareUserTags()

    userTagDao.deleteTags(tag2Id)

    var result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 4, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountIgnoreByUser,
      classOf[Integer], Integer.valueOf(user1Id))
    assertEquals("Wrong count of user tags.", 1, result)

    result = jdbcTemplate.queryForObject(
      UserTagDaoIntegrationTest.QueryCountFavoriteByUser,
      classOf[Integer], Integer.valueOf(user2Id))
    assertEquals("Wrong count of user tags.", 4, result)
  }

  @Test
  def getTest(): Unit = {
    prepareUserTags()

    var tags = userTagDao.getTags(user1Id, true)
    assertEquals("Wrong count of user tags.", 5, tags.size)

    tags = userTagDao.getTags(user1Id, false)
    assertEquals("Wrong count of user tags.", 2, tags.size)
  }

  @Test
  def getUserIdListByTagsTest(): Unit = {
    prepareUserTags()
    var userIdList = userTagDao.getUserIdListByTags(user1Id, Seq(tag1Id))
    assertEquals("Wrong count of user ID's.", 1, userIdList.size)

    userIdList = userTagDao.getUserIdListByTags(user1Id, Seq(tag1Id, tag2Id))
    assertEquals("Wrong count of user ID's.", 1, userIdList.size)

    userTagDao.deleteTag(user1Id, tag5Id, true)
    userIdList = userTagDao.getUserIdListByTags(user1Id, Seq(tag5Id))
    assertEquals("Wrong count of user ID's.", 1, userIdList.size)
  }

  @Test
  def replaceTagTest(): Unit = {
    prepareUserTags()

    userTagDao.replaceTag(tag2Id, tag1Id)
    var result = jdbcTemplate.queryForObject(
      "SELECT count(user_id) FROM user_tags WHERE tag_id=?",
      classOf[Integer], Integer.valueOf(tag1Id))
    assertEquals("Wrong count of user tags.", 2, result)

    userTagDao.deleteTags(tag1Id)
    userTagDao.replaceTag(tag2Id, tag1Id)
    result = jdbcTemplate.queryForObject(
      "SELECT count(user_id) FROM user_tags WHERE tag_id=?",
      classOf[Integer], Integer.valueOf(tag1Id))
    assertEquals("Wrong count of user tags.", 3, result)
  }
}