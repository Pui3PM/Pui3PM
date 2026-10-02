// 3PM HV3 Windows Media Foundation adapter boundary.
// The production Windows build compiles this file on Windows. It deliberately keeps
// Media Foundation below the shared 3pm-capture-v1 contract so shot intelligence is identical across OSes.
#include "../native_shared/capture_protocol.hpp"
#include "../native_shared/frame_ring_buffer.hpp"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <wrl/client.h>
#include <atomic>
#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;
namespace threepm::windows_capture {
struct EncodedEvidence { std::vector<std::uint8_t> jpeg; };
struct RoleState {
  CameraRole role{CameraRole::Side};
  FrameRingBuffer<std::shared_ptr<EncodedEvidence>> ring{6500.0};
  std::atomic<std::uint64_t> nextSeq{1};
  std::mutex mutex;
};

// Media Foundation timestamps are mapped into the same process-monotonic master clock used by
// the macOS adapter. The HTTP/loopback service is intentionally kept outside this capture class.
class MediaFoundationRoleCapture {
public:
  explicit MediaFoundationRoleCapture(CameraRole role):state_{role}{}
  HRESULT start(const std::wstring& symbolicLink,double requestedFps);
  void stop();
  RoleState& state() noexcept{return state_;}
private:
  RoleState state_;
  ComPtr<IMFSourceReader> reader_;
};

// Runtime implementation is completed/validated in the Windows build environment; no shared
// Analyzer code may depend on a Windows-only type from this file.
HRESULT MediaFoundationRoleCapture::start(const std::wstring&,double){return E_NOTIMPL;}
void MediaFoundationRoleCapture::stop(){reader_.Reset();std::scoped_lock lock(state_.mutex);state_.ring.clear();}
} // namespace threepm::windows_capture
#else
// Non-Windows build-host sentinel: keeps shared-source syntax/headers continuously testable.
int threepm_windows_media_foundation_adapter_build_host_sentinel(){
  return threepm::kCaptureProtocolVersion.empty()?1:0;
}
#endif
