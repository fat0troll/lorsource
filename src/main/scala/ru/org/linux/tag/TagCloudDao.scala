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
package ru.org.linux.tag

import org.springframework.scala.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

import javax.sql.DataSource
import scala.jdk.CollectionConverters.*
import scala.math.log

@Repository
class TagCloudDao(ds: DataSource) {
  private val jdbcTemplate = new JdbcTemplate(ds)

  def getTags(tagcount: Int): java.util.List[TagCloudDao.TagDTO] = {
    val sql = "select value,counter from tags_values where counter>=10 order by counter desc limit ?"
    var maxc = 1.0
    var minc = -1.0

    val result = jdbcTemplate.queryAndMap(sql, tagcount) { (rs, _) =>
      val tag = new TagCloudDao.TagDTO
      tag.setValue(rs.getString("value"))
      val counter = log(rs.getInt("counter"))
      tag.setCounter(counter)

      if maxc < counter then maxc = counter
      if minc < 0 || counter < minc then minc = counter

      tag
    }

    if minc < 0 then minc = 0

    result.foreach(tag => tag.setWeight(math.round(10 * (tag.getCounter - minc)
      / (maxc - minc)).toInt))

    val sorted = result.sortBy(_.getValue)
    sorted.asJava
  }
}

object TagCloudDao {
  class TagDTO extends Comparable[TagDTO] with java.io.Serializable {
    private var weight: Int = 0
    private var value: String = null
    private var counter: Double = 0.0

    def getWeight: Int = weight
    def setWeight(weight: Int): Unit = this.weight = weight
    def getValue: String = value
    def setValue(value: String): Unit = this.value = value
    def getCounter: Double = counter
    def setCounter(counter: Double): Unit = this.counter = counter

    override def compareTo(o: TagDTO): Int = value.compareTo(o.value)
  }
}