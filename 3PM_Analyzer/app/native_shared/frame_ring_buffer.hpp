#pragma once
#include "capture_protocol.hpp"
#include <algorithm>
#include <cstddef>
#include <deque>
#include <optional>
#include <utility>
#include <vector>

namespace threepm {
template<class Payload>
struct BufferedFrame {
  FrameClock clock;
  Payload payload;
};

template<class Payload>
class FrameRingBuffer {
public:
  using Frame=BufferedFrame<Payload>;
  explicit FrameRingBuffer(double retentionMs=6500.0):retentionMs_(std::max(500.0,retentionMs)){}
  void clear(){frames_.clear();}
  std::size_t size() const noexcept{return frames_.size();}
  double retentionMs() const noexcept{return retentionMs_;}
  void setRetentionMs(double ms){retentionMs_=std::max(500.0,ms);trim();}
  bool push(Frame frame){
    if(!frames_.empty()){
      const auto &last=frames_.back().clock;
      if(frame.clock.frameSeq<=last.frameSeq)return false;
      if(frame.clock.masterTimeMs+0.05<last.masterTimeMs)return false;
    }
    frames_.push_back(std::move(frame));trim();return true;
  }
  std::vector<Frame> window(double centerMasterMs,double preMs,double postMs) const{
    const double lo=centerMasterMs-std::max(0.0,preMs),hi=centerMasterMs+std::max(0.0,postMs);
    std::vector<Frame> out;for(const auto &f:frames_)if(f.clock.masterTimeMs>=lo&&f.clock.masterTimeMs<=hi)out.push_back(f);return out;
  }
  std::optional<Frame> nearest(double targetMasterMs,double fps,double jitterMs=0.0,double multiplier=1.25) const {
    if(frames_.empty()) return std::nullopt;
    const Frame* best=nullptr;
    double delta=1e100;
    for(const auto &f:frames_){
      const double d=std::abs(f.clock.masterTimeMs-targetMasterMs);
      if(d<delta){delta=d;best=&f;}
    }
    const double tol=adaptiveToleranceMs(fps,jitterMs)*std::max(1.0,multiplier);
    if(!best||delta>tol) return std::nullopt;
    return *best;
  }
  const std::deque<Frame>& frames() const noexcept{return frames_;}
private:
  void trim(){if(frames_.empty())return;const double cutoff=frames_.back().clock.masterTimeMs-retentionMs_;while(!frames_.empty()&&frames_.front().clock.masterTimeMs<cutoff)frames_.pop_front();}
  double retentionMs_;std::deque<Frame> frames_;
};
} // namespace threepm
