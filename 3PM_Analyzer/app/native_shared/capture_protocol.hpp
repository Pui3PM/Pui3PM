#pragma once
#include <array>
#include <cmath>
#include <cstdint>
#include <string_view>

namespace threepm {
inline constexpr std::string_view kCaptureProtocolVersion = "3pm-capture-v1";
enum class CameraRole { Side, Overhead, Rear };
inline constexpr std::array<CameraRole,3> kCameraRoles{CameraRole::Side,CameraRole::Overhead,CameraRole::Rear};
inline constexpr std::string_view roleName(CameraRole r) {
  switch(r){case CameraRole::Side:return "side";case CameraRole::Overhead:return "overhead";case CameraRole::Rear:return "rear";}
  return "unknown";
}
struct FrameClock {
  std::uint64_t frameSeq{};
  double captureEpochMs{};   // wall-clock bridge/debug only
  double masterTimeMs{};     // monotonic process clock: fusion authority
  double mediaTimeMs{};      // camera/sample presentation time when available
};
inline double adaptiveToleranceMs(double fps,double jitterMs=0.0){
  const double f=std::max(1.0,fps);
  return std::max(2.0,std::min(50.0,500.0/f+std::max(0.0,jitterMs)*1.5));
}
} // namespace threepm
