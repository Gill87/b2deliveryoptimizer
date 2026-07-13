#pragma once

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterWhatsAppEndpoint(drogon::HttpAppFramework& app);

} // namespace deliveryoptimizer::api
