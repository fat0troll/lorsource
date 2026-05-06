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
package ru.org.linux.topic

import org.springframework.scala.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import ru.org.linux.group.Group
import ru.org.linux.section.Section
import scala.beans.BeanProperty
import scala.jdk.CollectionConverters.*
import javax.annotation.Nullable

case class ArchiveStats(@BeanProperty section: Section, @Nullable @BeanProperty group: Group,
                        @BeanProperty year: Int, @BeanProperty month: Int, @BeanProperty count: Int):

  @BeanProperty
  def getLink: String =
    if group != null then
      group.getArchiveLink(year, month)
    else
      section.getArchiveLink(year, month)

@Repository
class ArchiveDao(ds: javax.sql.DataSource):
  private val jdbcTemplate = JdbcTemplate(ds)

  def getArchiveStats(section: Section, group: Option[Group]): java.util.List[ArchiveStats] =
    group match
      case None =>
        jdbcTemplate.queryAndMap(
          "select year, month, c from monthly_stats where section=? and groupid is null order by year, month",
          section.id
        )((rs, _) => ArchiveStats(section, null, rs.getInt("year"), rs.getInt("month"), rs.getInt("c"))).asJava
      case Some(g) =>
        jdbcTemplate.queryAndMap(
          "select year, month, c from monthly_stats where section=? and groupid=? order by year, month",
          section.id,
          g.id
        )((rs, _) => ArchiveStats(section, g, rs.getInt("year"), rs.getInt("month"), rs.getInt("c"))).asJava

  def getArchiveCount(groupid: Int, year: Int, month: Int): Int =
    jdbcTemplate.queryForObject[Int](
      "SELECT c FROM monthly_stats WHERE groupid=? AND year=? AND month=?",
      groupid,
      year,
      month
    ).getOrElse(0)