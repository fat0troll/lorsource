<%@ page contentType="text/html; charset=utf-8"%>
<%--
  ~ Copyright 1998-2024 Linux.org.ru
  ~    Licensed under the Apache License, Version 2.0 (the "License");
  ~    you may not use this file except in compliance with the License.
  ~    You may obtain a copy of the License at
  ~
  ~        http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~    Unless required by applicable law or agreed to in writing, software
  ~    distributed under the License is distributed on an "AS IS" BASIS,
  ~    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  ~    See the License for the specific language governing permissions and
  ~    limitations under the License.
  --%>
<%@ taglib tagdir="/WEB-INF/tags" prefix="lor" %>
<%@ taglib prefix="form" uri="http://www.springframework.org/tags/form" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>

<jsp:include page="/WEB-INF/jsp/head.jsp"/>

<title>Уведомить модераторов</title>
<jsp:include page="/WEB-INF/jsp/header.jsp"/>

<h1>Уведомить модераторов</h1>

<form:form method="POST" action="/post-warning" class="form-horizontal" modelAttribute="request">
<lor:csrf/>
  <div class="control-group">
    <label class="control-label" for="reason-input">
      Комментарий
    </label>

    <div class="controls">
      <form:textarea id="reason-input" path="text" maxlength="140" required="required" style="width: 40em"/>
    </div>
  </div>

  <div class="control-group">
    <div class="controls">
      <form:errors element="div" cssClass="error" path="*"/>
    </div>
  </div>

  <form:input id="topic" path="topic" type="hidden"/>
  <form:input id="comment" path="comment" type="hidden"/>

  <div class="control-group">
    <div class="controls">
      <button type=submit class="btn btn-primary">Уведомить</button>
    </div>
  </div>
</form:form>
<jsp:include page="/WEB-INF/jsp/footer.jsp"/>