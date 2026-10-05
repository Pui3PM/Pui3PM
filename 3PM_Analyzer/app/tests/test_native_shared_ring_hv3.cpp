#include "../native_shared/frame_ring_buffer.hpp"
#include <cassert>
#include <string>
int main(){
  using namespace threepm;FrameRingBuffer<std::string> b(1000.0);
  assert(b.push({{1,1000,10,0},"a"}));assert(b.push({{2,1033,43,33},"b"}));assert(b.push({{3,1066,76,66},"c"}));
  assert(!b.push({{3,1067,77,67},"dup"}));
  auto n=b.nearest(44,30);assert(n&&n->clock.frameSeq==2);
  auto w=b.window(43,40,40);assert(w.size()==3);
  assert(adaptiveToleranceMs(30)>16&&adaptiveToleranceMs(30)<17);
  return 0;
}
