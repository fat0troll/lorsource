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

package ru.org.linux.group

import com.typesafe.scalalogging.StrictLogging
import org.apache.commons.lang3.StringUtils
import org.springframework.dao.EmptyResultDataAccessException
import org.springframework.scala.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import ru.org.linux.section.Section

import java.sql.PreparedStatement
import javax.sql.DataSource

@Repository
class GroupDao(ds: DataSource) extends StrictLogging:
  private val jdbcTemplate = JdbcTemplate(ds)

  /**
   * Получить объект группы по идентификатору.
   *
   * @param id идентификатор группы
   * @return объект группы
   * @throws GroupNotFoundException если группа не существует
   */
  def getGroup(id: Int): Group =
    try
      jdbcTemplate.queryForObjectAndMap(
        "SELECT sections.moderate, vote, section, havelink, linktext, title, urlname, image, groups.restrict_topics, restrict_comments,stat3,groups.id, groups.info, groups.longinfo, groups.resolvable FROM groups, sections WHERE groups.id=? AND groups.section=sections.id",
        id
      )((rs, _) => Group.buildGroup(rs)).orNull
    catch
      case _: EmptyResultDataAccessException =>
        throw new GroupNotFoundException(s"Группа $id не существует")

  /**
   * Получить список групп в указанной секции.
   *
   * @param section объект секции.
   * @return список групп
   */
  def getGroups(section: Section): Seq[Group] =
    jdbcTemplate.queryAndMap(
      "SELECT sections.moderate, vote, section, havelink, linktext, title, urlname, image, groups.restrict_topics, restrict_comments, stat3,groups.id,groups.info,groups.longinfo,groups.resolvable FROM groups, sections WHERE sections.id=? AND groups.section=sections.id ORDER BY id",
      section.id
    )((rs, _) => Group.buildGroup(rs))

  /**
   * Получить объект группы в указанной секции по имени группы.
   *
   * @param section объект секции.
   * @param name    имя группы
   * @return объект группы
   * @throws GroupNotFoundException если группа не существует
   */
  def getGroup(section: Section, name: String): Group =
    val group = getGroupOpt(section, name, false)

    if group.isEmpty then
      logger.info(s"Group '$name' not found in section ${section.getUrlName}")
      throw new GroupNotFoundException("group not found")
    else
      group.get

  /**
   * Получить объект группы в указанной секции по имени группы.
   *
   * @param section      объект секции.
   * @param name          имя группы
   * @param allowNumber   разрешить поиск по числовому id
   * @return объект группы (optional)
   */
  def getGroupOpt(section: Section, name: String, allowNumber: Boolean): Option[Group] =
    try
      if allowNumber && StringUtils.isNumeric(name) then
        val id = jdbcTemplate.queryForObject[Int](
          "SELECT id FROM groups WHERE section=? AND id=?",
          section.id,
          Integer.parseInt(name)
        ).get
        Some(getGroup(id))
      else if StringUtils.isAsciiPrintable(name) then
        val id = jdbcTemplate.queryForObject[Int](
          "SELECT id FROM groups WHERE section=? AND urlname=?",
          section.id,
          name
        ).get
        Some(getGroup(id))
      else
        None
    catch
      case _: EmptyResultDataAccessException =>
        logger.debug(s"Group '$name' not found in section ${section.getUrlName}")
        None

  /**
   * Изменить настройки группы.
   *
   * @param group      объект группы
   * @param title      Заголовок группы
   * @param info       дополнительная информация
   * @param longInfo   расширенная дополнительная информация
   * @param resolvable можно ли ставить темам признак "тема решена"
   * @param urlName    имя группы в URL
   */
  def setParams(group: Group, title: String, info: String, longInfo: String, resolvable: Boolean, urlName: String): Unit =
    jdbcTemplate.executePreparedStatement(
      "UPDATE groups SET title=?, info=?, longinfo=?,resolvable=?,urlname=? WHERE id=?"
    ) { (pst: PreparedStatement) =>
      pst.setString(1, title)

      if info.nonEmpty then
        pst.setString(2, info)
      else
        pst.setString(2, null)

      if longInfo.nonEmpty then
        pst.setString(3, longInfo)
      else
        pst.setString(3, null)

      pst.setBoolean(4, resolvable)
      pst.setString(5, urlName)
      pst.setInt(6, group.id)

      pst.executeUpdate()
    }