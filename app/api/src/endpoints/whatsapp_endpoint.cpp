#include "deliveryoptimizer/api/endpoints/whatsapp_endpoint.hpp"

#include "env_utils.hpp"

#include <drogon/drogon.h>
#include <functional>
#include <json/json.h>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace {

constexpr std::string_view kDefaultWhatsAppBaseUrl = "https://graph.facebook.com";
constexpr char kWhatsAppBaseUrlEnv[] = "WHATSAPP_API_BASE_URL";
constexpr char kWhatsAppAccessTokenEnv[] = "WHATSAPP_ACCESS_TOKEN";
constexpr char kWhatsAppPhoneNumberIdEnv[] = "WHATSAPP_PHONE_NUMBER_ID";
constexpr char kSendRoutePath[] = "/api/whatsapp/send-route";
constexpr char kToField[] = "to";
constexpr char kMessageField[] = "message";

[[nodiscard]] drogon::HttpResponsePtr BuildJsonResponse(const Json::Value& body,
                                                        const drogon::HttpStatusCode code) {
  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(code);
  return response;
}

[[nodiscard]] drogon::HttpResponsePtr BuildErrorResponse(const drogon::HttpStatusCode code,
                                                         const std::string_view error_message) {
  Json::Value body{Json::objectValue};
  body["error"] = std::string{error_message};
  return BuildJsonResponse(body, code);
}

[[nodiscard]] std::optional<std::string> ReadNonEmptyStringMember(const Json::Value& body,
                                                                  const char* field_name) {
  if (!body.isMember(field_name) || !body[field_name].isString()) {
    return std::nullopt;
  }

  auto value = body[field_name].asString();
  if (value.empty()) {
    return std::nullopt;
  }

  return value;
}

[[nodiscard]] bool IsSuccessStatus(const drogon::HttpStatusCode status_code) {
  const auto status = static_cast<int>(status_code);
  return status >= 200 && status < 300;
}

[[nodiscard]] Json::Value BuildWhatsAppPayload(const std::string& to_number,
                                               const std::string& message) {
  Json::Value payload{Json::objectValue};
  payload["messaging_product"] = "whatsapp";
  payload["to"] = to_number;
  payload["type"] = "text";
  payload["text"]["body"] = message;
  return payload;
}

[[nodiscard]] drogon::HttpResponsePtr
BuildUpstreamFailureResponse(const drogon::HttpResponsePtr& upstream_response) {
  Json::Value body{Json::objectValue};
  body["error"] = "WhatsApp upstream request failed.";
  if (upstream_response != nullptr) {
    body["upstream_status"] = static_cast<int>(upstream_response->getStatusCode());
  }
  return BuildJsonResponse(body, drogon::k502BadGateway);
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterWhatsAppEndpoint(drogon::HttpAppFramework& app) {
  const auto whatsapp_base_url =
      ResolveNormalizedUrlEnvOrDefault(kWhatsAppBaseUrlEnv, kDefaultWhatsAppBaseUrl);
  auto whatsapp_client = drogon::HttpClient::newHttpClient(whatsapp_base_url);

  app.registerHandler(
      kSendRoutePath,
      [whatsapp_client = std::move(whatsapp_client)](
          const drogon::HttpRequestPtr& request,
          std::function<void(const drogon::HttpResponsePtr&)>&& callback) mutable {
        const auto request_body = request->getJsonObject();
        if (request_body == nullptr) {
          std::move(callback)(
              BuildErrorResponse(drogon::k400BadRequest, "Request body must be valid JSON."));
          return;
        }

        const auto to_number = ReadNonEmptyStringMember(*request_body, kToField);
        if (!to_number.has_value()) {
          std::move(callback)(
              BuildErrorResponse(drogon::k400BadRequest, "Request body must include to."));
          return;
        }

        const auto message = ReadNonEmptyStringMember(*request_body, kMessageField);
        if (!message.has_value()) {
          std::move(callback)(
              BuildErrorResponse(drogon::k400BadRequest, "Request body must include message."));
          return;
        }

        const auto access_token = ResolveEnvOrDefault(kWhatsAppAccessTokenEnv, "");
        const auto phone_number_id = ResolveEnvOrDefault(kWhatsAppPhoneNumberIdEnv, "");
        if (access_token.empty() || phone_number_id.empty()) {
          std::move(callback)(
              BuildErrorResponse(drogon::k503ServiceUnavailable, "WhatsApp is not configured."));
          return;
        }

        auto upstream_request = drogon::HttpRequest::newHttpRequest();
        upstream_request->setMethod(drogon::Post);
        upstream_request->setPath("/v18.0/" + phone_number_id + "/messages");
        upstream_request->addHeader("Authorization", "Bearer " + access_token);
        upstream_request->setContentTypeCode(drogon::CT_APPLICATION_JSON);

        const auto payload = BuildWhatsAppPayload(*to_number, *message);
        upstream_request->setBody(payload.toStyledString());

        whatsapp_client->sendRequest(
            upstream_request,
            [callback = std::move(callback)](const drogon::ReqResult result,
                                             const drogon::HttpResponsePtr& response) mutable {
              if (result == drogon::ReqResult::Ok && response != nullptr &&
                  IsSuccessStatus(response->getStatusCode())) {
                std::move(callback)(response);
                return;
              }

              std::move(callback)(BuildUpstreamFailureResponse(response));
            });
      },
      {drogon::Post});
}

} // namespace deliveryoptimizer::api
