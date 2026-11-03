// Joint rotations in radians, [x, y, z]. Joints not listed stay at 0.
// x bends forward/back, z swings sideways. Left = the mannequin's left (screen right when facing you).
export const POSES = {
  standing: {
    label: 'Standing',
    joints: {
      lShoulder: [0, 0, 0.1], rShoulder: [0, 0, -0.1],
      lElbow: [-0.12, 0, 0], rElbow: [-0.12, 0, 0],
      lHip: [0, 0, 0.03], rHip: [0, 0, -0.03],
    },
  },
  hip: {
    label: 'Hand on hip',
    joints: {
      hips: [0, 0, 0.05], spine: [0, 0, -0.06], chest: [0, 0.08, -0.03], head: [0.04, -0.12, 0.05],
      lShoulder: [0.1, 0, 0.78], lElbow: [-1.85, 0.4, 0], lWrist: [0, 0, -0.3],
      rShoulder: [0.05, 0, -0.12], rElbow: [-0.15, 0, 0],
      lHip: [0.02, 0, 0.02], rHip: [-0.18, 0, -0.12], rKnee: [0.3, 0, 0],
    },
  },
  step: {
    label: 'Mid-step',
    joints: {
      spine: [0.03, 0.05, 0], chest: [0, -0.1, 0], head: [0, 0.08, 0],
      lShoulder: [0.38, 0, 0.08], lElbow: [-0.5, 0, 0],
      rShoulder: [-0.32, 0, -0.08], rElbow: [-0.35, 0, 0],
      lHip: [-0.32, 0, 0.03], lKnee: [0.18, 0, 0], lAnkle: [0.12, 0, 0],
      rHip: [0.28, 0, -0.03], rKnee: [0.5, 0, 0], rAnkle: [-0.3, 0, 0],
    },
  },
  relaxed: {
    label: 'Relaxed',
    joints: {
      hips: [0, 0.1, -0.06], spine: [0.02, 0, 0.05], chest: [0, -0.06, 0.03], neck: [0.06, 0, 0], head: [0.1, 0.25, -0.06],
      lShoulder: [-0.1, 0, 0.12], lElbow: [-0.22, 0, 0],
      rShoulder: [0.15, 0, -0.16], rElbow: [-1.1, -0.3, 0],
      lHip: [-0.05, 0, 0.12], lKnee: [0.22, 0, 0],
      rHip: [0, 0, -0.05],
    },
  },
};

export const POSE_KEYS = Object.keys(POSES);
