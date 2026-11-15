import { movementProgress } from "../world/motion";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  type RefObject,
  type ComponentProps,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useTown } from "../store";
import { buildings, pointAlong, roadPath } from "../world/map";
import type { Building, Citizen, Point } from "../world/types";
// Keep scene labels in a stable dedicated portal rather than the event connector,
// which changes during canvas startup and can race React DOM cleanup.
const LabelsPortal = createContext<RefObject<HTMLElement> | undefined>(
  undefined,
);
function WorldHtml(props: ComponentProps<typeof Html>) {
  const portal = useContext(LabelsPortal);
  return <Html {...props} portal={portal} />;
}
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const boxMaterials = new Map<string, THREE.MeshStandardMaterial>();
function boxMaterial(color: string) {
  let result = boxMaterials.get(color);
  if (!result) {
    result = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      emissive: ["#7be3e8", "#eab882", "#98dcce"].includes(color)
        ? color
        : "#000000",
      emissiveIntensity: 0.45,
    });
    boxMaterials.set(color, result);
  }
  return result;
}
const material = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.9} />
);
function Box({
  p,
  s,
  c,
  rotation = 0,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  rotation?: number;
}) {
  return (
    <mesh
      position={p}
      scale={s}
      rotation-y={rotation}
      geometry={boxGeometry}
      material={boxMaterial(c)}
      dispose={null}
      castShadow
      receiveShadow
    />
  );
}
function Roof({
  color = "#b77351",
  scale = 1,
}: {
  color?: string;
  scale?: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.9, 0);
    shape.lineTo(0, 1.65);
    shape.lineTo(1.9, 0);
    shape.lineTo(-1.9, 0);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 3.7,
      bevelEnabled: false,
    });
    g.translate(0, 0, -1.85);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} position-y={2.5} scale={scale} castShadow>
      {material(color)}
    </mesh>
  );
}
function AgentRoom({ building }: { building: Building }) {
  const accent = Number(building.id.split("-")[1]) < 10 ? "#7be3e8" : "#eab882";
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[5, 0.2, 5]} c="#aa927b" />
      {[
        [0, 1.45, -2.45, 5.0, 2.6, 0.08],
        [-2.45, 1.45, 0, 0.08, 2.6, 5],
        [2.45, 1.45, 0, 0.08, 2.6, 5],
        [0, 1.45, 2.45, 5, 2.6, 0.08],
      ].map((v, i) => (
        <mesh key={i} position={[v[0], v[1], v[2]]} raycast={() => null}>
          <boxGeometry args={[v[3], v[4], v[5]]} />
          <meshPhysicalMaterial
            color="#c8d9df"
            transparent
            opacity={0.14}
            roughness={0.35}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[-2.45, 2.45].map((x) => (
        <group key={x}>
          <Box p={[x, 2.8, 0]} s={[0.08, 0.1, 5]} c={accent} />
          {[-2.45, 2.45].map((z) => (
            <Box key={z} p={[x, 1.45, z]} s={[0.07, 2.7, 0.07]} c="#8499a2" />
          ))}
        </group>
      ))}
      {[-2.45, 2.45].map((z) => (
        <Box key={z} p={[0, 2.8, z]} s={[5, 0.1, 0.08]} c={accent} />
      ))}
      <Box p={[1.05, 0.38, 0.85]} s={[1.5, 0.55, 2.3]} c="#5c6c70" />
      <Box p={[1.05, 0.7, 1.15]} s={[1.45, 0.14, 1.65]} c={building.color} />
      <Box p={[1.05, 0.76, -0.03]} s={[1.1, 0.14, 0.46]} c="#e2e4da" />
      <Box p={[1.05, 0.72, -0.4]} s={[1.6, 0.9, 0.12]} c="#839396" />
      <Box p={[-1.05, 0.85, -1.18]} s={[1.7, 0.13, 1]} c="#b2a18b" />
      {[-1.7, -0.4].map((x) => (
        <Box key={x} p={[x, 0.48, -1.18]} s={[0.09, 0.8, 0.85]} c="#6d7f82" />
      ))}
      <Box p={[-1.05, 1.22, -1.5]} s={[0.76, 0.55, 0.08]} c="#202f3b" />
      <mesh position={[-1.05, 1.23, -1.45]}>
        <boxGeometry args={[0.64, 0.43, 0.015]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Box p={[-1.05, 0.96, -1]} s={[0.65, 0.05, 0.26]} c="#455861" />
      <Box p={[-1.05, 0.52, 0.05]} s={[0.7, 0.12, 0.65]} c="#697e81" />
      <Box p={[-1.05, 0.85, 0.35]} s={[0.7, 0.7, 0.1]} c="#697e81" />
      <Box p={[-1.05, 0.3, 0.05]} s={[0.12, 0.5, 0.12]} c="#576b75" />
      <Box p={[-1.7, 0.5, 1.6]} s={[0.65, 0.85, 0.65]} c="#8a9c8a" />
      <mesh position={[-1.7, 1.2, 1.6]}>
        <icosahedronGeometry args={[0.48, 1]} />
        {material("#88a478")}
      </mesh>
    </group>
  );
}
function Cottage({ building }: { building: Building }) {
  const night = useTown((s) => s.world.tick % 6 >= 4);
  const observation = useTown((s) => s.observation);
  if (
    observation &&
    building.kind === "home" &&
    building.name !== "Town Library" &&
    building.id.startsWith("home-")
  )
    return <AgentRoom building={building} />;
  return (
    <group>
      <Box p={[0, 1.25, 0]} s={[3.3, 2.5, 3.1]} c={building.color} />
      <Roof
        color={
          ["#ad7054", "#738575", "#af7e61"][
            Number(building.id.split("-")[1]) % 3
          ]
        }
      />
      <Box p={[-0.5, 0.7, 1.57]} s={[0.64, 1.4, 0.09]} c="#685840" />
      <Box
        p={[0.8, 1.4, 1.58]}
        s={[0.65, 0.8, 0.07]}
        c={night ? "#ffe4a1" : "#b4d0c5"}
      />
      <Box p={[0.8, 1.4, 1.64]} s={[0.06, 0.8, 0.05]} c="#f0e3c8" />
      <Box p={[0.8, 1.4, 1.64]} s={[0.65, 0.06, 0.05]} c="#f0e3c8" />
      <Box p={[1, 3.5, -0.6]} s={[0.5, 1.9, 0.6]} c="#c5b69c" />
      <Box p={[0, 0.12, 2]} s={[1.4, 0.24, 0.6]} c="#b9b19a" />
      <mesh position={[-1.6, 0.3, 2]}>
        <sphereGeometry args={[0.45, 7, 5]} />
        {material("#7e9955")}
      </mesh>
    </group>
  );
}
function Tree({
  position,
  scale = 1,
  round = false,
}: {
  position: [number, number, number];
  scale?: number;
  round?: boolean;
}) {
  return (
    <group position={position} scale={scale}>
      <Box p={[0, 0.85, 0]} s={[0.4, 1.7, 0.4]} c="#806447" />
      {round ? (
        <>
          <mesh position={[0, 2.5, 0]} castShadow>
            <icosahedronGeometry args={[1.55, 1]} />
            {material("#7e9957")}
          </mesh>
          <mesh position={[0.7, 2, 0]} castShadow>
            <icosahedronGeometry args={[1.1, 0]} />
            {material("#92a764")}
          </mesh>
        </>
      ) : (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 1.5 + i * 0.9, 0]} castShadow>
              <coneGeometry args={[1.5 - i * 0.3, 2.4, 7]} />
              {material(i === 2 ? "#577a4c" : "#648654")}
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
function CouncilChamber() {
  const open = useTown(
    (s) => s.world.proposals?.filter((p) => p.status === "open").length ?? 0,
  );
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[8.5, 0.2, 7]} c="#9a8e7e" />
      {[-4.2, 4.2].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.7, 0]} raycast={() => null}>
            <boxGeometry args={[0.08, 3.2, 7]} />
            <meshPhysicalMaterial
              color="#bfd4dc"
              transparent
              opacity={0.12}
              roughness={0.3}
              depthWrite={false}
            />
          </mesh>
          <Box p={[x, 3.35, 0]} s={[0.1, 0.12, 7]} c="#98dcce" />
        </group>
      ))}
      <mesh position={[0, 1.7, -3.45]} raycast={() => null}>
        <boxGeometry args={[8.5, 3.2, 0.08]} />
        <meshPhysicalMaterial
          color="#bfd4dc"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
      {[-3.45, 3.45].map((z) => (
        <Box key={z} p={[0, 3.35, z]} s={[8.5, 0.12, 0.1]} c="#98dcce" />
      ))}
      <Box p={[0, 0.95, -0.6]} s={[3.7, 0.17, 2]} c="#667d83" />
      {[-2.7, 2.7].map((x) =>
        [-1.7, -0.5, 0.7].map((z) => (
          <group key={`${x}-${z}`}>
            <Box p={[x, 0.55, z]} s={[0.7, 0.16, 0.7]} c="#526b78" />
            <Box p={[x, 0.95, z + 0.3]} s={[0.7, 0.8, 0.1]} c="#526b78" />
          </group>
        )),
      )}
      <Box p={[0, 2, -3.3]} s={[3.4, 1.6, 0.1]} c="#223744" />
      <WorldHtml
        position={[0, 2.1, -3.15]}
        center
        distanceFactor={18}
        zIndexRange={[20, 0]}
      >
        <div className="chamber-sign">
          TOWN COUNCIL
          <small>{open} open proposals · every citizen has a voice</small>
        </div>
      </WorldHtml>
    </group>
  );
}
function Hall() {
  const observation = useTown((s) => s.observation);
  if (observation) return <CouncilChamber />;
  return (
    <group>
      <Box p={[0, 1.8, 0]} s={[6.5, 3.6, 4.7]} c="#e4d6b8" />
      <group position={[0, 1.1, 0]} scale={[1.9, 1, 1.5]}>
        <Roof color="#6f8278" />
      </group>
      <Box p={[0, 4.4, 0.4]} s={[1.8, 4.2, 1.8]} c="#e4d8be" />
      <mesh position={[0, 7, 0.4]} castShadow>
        <coneGeometry args={[1.55, 1.9, 4]} />
        {material("#687c6d")}
      </mesh>
      <mesh position={[0, 5.65, 1.32]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.59, 0.59, 0.08, 24]} />
        {material("#fff5d7")}
      </mesh>
      <Box p={[0, 5.85, 1.39]} s={[0.06, 0.42, 0.04]} c="#53624b" />
      <Box p={[0.14, 5.65, 1.39]} s={[0.3, 0.06, 0.04]} c="#53624b" />
      <Box p={[0, 1.1, 2.4]} s={[1.1, 2.2, 0.12]} c="#7c8062" />
      {[-2.2, 2.2].map((x) => (
        <group key={x}>
          <Box p={[x, 1.9, 2.4]} s={[0.85, 1.4, 0.12]} c="#a6c2b4" />
          <Box p={[x, 1.9, 2.49]} s={[0.06, 1.4, 0.08]} c="#f2e5c8" />
        </group>
      ))}
      <Box p={[0, 0.15, 3]} s={[4, 0.3, 1.4]} c="#c7bda3" />
      <Box p={[0, 0.07, 3.7]} s={[4.7, 0.14, 0.6]} c="#c7bda3" />
    </group>
  );
}
function Farm() {
  const expanded = useTown((s) => s.world.upgrades?.includes("farm"));
  const tick = useTown((s) => s.world.tick);
  return (
    <group>
      {expanded && (
        <group position={[0, 0, -6]}>
          <Box p={[0, 0.15, 0]} s={[5, 0.3, 2.5]} c="#c7b894" />
          <Box p={[0, 1.1, 0]} s={[5, 1.8, 2.5]} c="#b9d2b5" />
          {[-2, 0, 2].map((x) => (
            <Box key={x} p={[x, 1.1, 1.28]} s={[0.08, 1.8, 0.06]} c="#eee6c8" />
          ))}
          <WorldHtml
            position={[0, 2.7, 0]}
            center
            distanceFactor={55}
            zIndexRange={[20, 0]}
          >
            <span className="farm-upgrade">
              Expanded farm · +6 food per farmer
            </span>
          </WorldHtml>
        </group>
      )}
      <Box p={[0, 0.06, 0]} s={[9, 0.18, 8]} c="#80694c" />
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i}>
          {Array.from({ length: 7 }, (_, j) => (
            <group key={j} position={[-3.6 + i, 0, -3 + j]}>
              <mesh position-y={0.3 + (tick % 4) * 0.09}>
                <coneGeometry args={[0.3, 0.8 + (tick % 4) * 0.18, 4]} />
                {material((i + j) % 3 === 0 ? "#cfbc65" : "#8fa64d")}
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <group position={[-5, 0, -2]} scale={0.8}>
        <Cottage building={{ ...buildings[6], color: "#c8a575" }} />
      </group>
      {[-4.9, 4.9].map((x) => (
        <group key={x}>
          {[-4, -2, 0, 2, 4].map((z) => (
            <Box key={z} p={[x, 0.5, z]} s={[0.16, 1, 0.16]} c="#ded0aa" />
          ))}
          <Box p={[x, 0.65, 0]} s={[0.13, 0.13, 8]} c="#ded0aa" />
        </group>
      ))}
    </group>
  );
}
function Market() {
  return (
    <group>
      {[-2.5, 2.5].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 0.6, 0]} s={[3.2, 1.2, 1.8]} c="#b6966c" />
          {[-1.5, 1.5].map((j) => (
            <Box key={j} p={[j, 1.7, 0]} s={[0.12, 3.4, 0.12]} c="#826a4e" />
          ))}
          {Array.from({ length: 6 }, (_, j) => (
            <Box
              key={j}
              p={[-1.4 + j * 0.55, 2.9, 0]}
              s={[0.56, 0.16, 2.7]}
              c={j % 2 === 0 ? (i === 0 ? "#b97e57" : "#78967c") : "#eee3c6"}
              rotation={0}
            />
          ))}
          {[-0.8, 0, 0.8].map((j, k) => (
            <mesh key={j} position={[j, 1.35, 0]}>
              <sphereGeometry args={[0.3, 6, 5]} />
              {material(k % 2 ? "#d1a348" : "#ab6654")}
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
function Fountain() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current)
      water.current.scale.y = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
  });
  return (
    <group>
      <mesh position-y={0.2} receiveShadow>
        <cylinderGeometry args={[2.5, 2.7, 0.4, 12]} />
        {material("#bebca4")}
      </mesh>
      <mesh position-y={0.44}>
        <cylinderGeometry args={[2.2, 2.2, 0.16, 32]} />
        <meshStandardMaterial
          color="#8dbfb8"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>
      <mesh position-y={1}>
        <cylinderGeometry args={[0.25, 0.4, 1.3, 8]} />
        {material("#cbc8b0")}
      </mesh>
      <mesh position-y={1.7}>
        <cylinderGeometry args={[1.1, 0.5, 0.3, 12]} />
        {material("#cdc9b3")}
      </mesh>
      <mesh ref={water} position-y={2.05}>
        <sphereGeometry args={[0.34, 12, 8]} />
        <meshStandardMaterial color="#bbdcd2" transparent opacity={0.8} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i * Math.PI) / 2) * 0.55,
            1.5,
            Math.sin((i * Math.PI) / 2) * 0.55,
          ]}
          rotation-z={0.5}
        >
          <cylinderGeometry args={[0.05, 0.08, 1.6, 5]} />
          {material("#afd5cd")}
        </mesh>
      ))}
    </group>
  );
}
function Construction() {
  const progress = useTown((s) => s.world.construction);
  if (progress >= 100)
    return (
      <group scale={[1.6, 1.2, 1.35]}>
        <Cottage
          building={{
            id: "home-1",
            name: "Town Library",
            kind: "home",
            position: [0, 0],
            color: "#e6d8b6",
          }}
        />
        <WorldHtml
          position={[0, 4.9, 0]}
          center
          distanceFactor={45}
          zIndexRange={[20, 0]}
        >
          <span className="farm-upgrade">Town library · open to everyone</span>
        </WorldHtml>
      </group>
    );
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[6, 0.2, 5]} c="#c3b69a" />
      {[-2.6, 2.6].map((x) =>
        [-2, 2].map((z) => (
          <Box
            key={`${x}${z}`}
            p={[x, 1.3, z]}
            s={[0.24, 2.6, 0.24]}
            c="#a58b60"
          />
        )),
      )}
      <Box p={[0, 2.7, -2]} s={[5.8, 0.22, 0.22]} c="#a58b60" />
      <Box p={[0, 2.7, 2]} s={[5.8, 0.22, 0.22]} c="#a58b60" />
      {progress > 40 && <Box p={[0, 1, -2]} s={[5.5, 2, 0.25]} c="#d4c5a6" />}
      {progress > 80 && (
        <group scale={[1.6, 1, 1.35]} position-y={0.3}>
          <Roof color="#879079" />
        </group>
      )}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[-3.8 + i * 0.2, 0.2 + i * 0.18, 2.5]}
          s={[1.6, 0.18, 0.4]}
          c="#aa8c62"
        />
      ))}
      <Box p={[3, 0.5, 2]} s={[0.2, 1, 0.2]} c="#8e7857" />
      <Box p={[3, 1, 2]} s={[1.6, 0.6, 0.1]} c="#e9d7ad" />
    </group>
  );
}
function TownBuilding({ building }: { building: Building }) {
  const selected = useTown((s) => s.selected === building.id),
    select = useTown((s) => s.select);
  return (
    <group
      position={[building.position[0], 0, building.position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        select(building.id);
      }}
    >
      {building.kind === "home" ? (
        <Cottage building={building} />
      ) : building.kind === "hall" ? (
        <Hall />
      ) : building.kind === "farm" ? (
        <Farm />
      ) : building.kind === "market" ? (
        <Market />
      ) : building.kind === "fountain" ? (
        <Fountain />
      ) : building.kind === "construction" ? (
        <Construction />
      ) : (
        <>
          {Array.from({ length: 14 }, (_, i) => (
            <Tree
              key={i}
              position={[(i % 4) * 2.8 - 3, 0, Math.floor(i / 4) * 2.8 - 3]}
              scale={0.8 + (i % 3) * 0.15}
            />
          ))}
        </>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
          <ringGeometry
            args={[
              building.kind === "home" ? 2.5 : 4.5,
              building.kind === "home" ? 2.63 : 4.65,
              48,
            ]}
          />
          <meshBasicMaterial color="#e9bd60" />
        </mesh>
      )}
    </group>
  );
}
function CitizenAvatar({
  citizen: c,
  wave,
}: {
  citizen: Citizen;
  wave: number;
}) {
  const group = useRef<THREE.Group>(null),
    left = useRef<THREE.Group>(null),
    right = useRef<THREE.Group>(null),
    arm = useRef<THREE.Group>(null),
    otherArm = useRef<THREE.Group>(null),
    bodyPose = useRef<THREE.Group>(null);
  const select = useTown((s) => s.select),
    selected = useTown((s) => s.selected === c.id),
    paused = useTown((s) => s.world.paused),
    updatedAt = useTown((s) => s.world.updatedAt),
    speed = useTown((s) => s.world.speed),
    frozenAt = useTown((s) => s.world.pausedAt);
  const path = useMemo(
    () => roadPath(c.previousPosition, c.position),
    [c.previousPosition, c.position],
  );
  const [hover, setHover] = useState(false);
  const observation = useTown((s) => s.observation),
    openWriting = useTown((s) => s.openChronicle);
  const writing = useTown((s) =>
    s.world.writings?.find((e) => e.authorId === c.id),
  );
  const target = useTown(
    (s) => s.world.citizens.find((p) => p.id === c.target)?.name,
  );
  const repair = useTown(
    (s) =>
      s.world.challenge?.status === "active" &&
      s.world.challenge.kind === "repair",
  );
  const report = useTown((s) =>
    s.world.lastTick?.decisions.find((d) => d.citizenId === c.id),
  );
  const active = Number(c.id.split("-")[1]) % 6 === wave % 6;
  const activity =
    c.action === "reflect"
      ? "Writing a journal"
      : c.action === "publish"
        ? "Publishing a post"
        : c.action === "propose"
          ? "Proposing a policy"
          : c.action === "discuss"
            ? "Commenting on a proposal"
            : c.action === "vote"
              ? "Casting a vote"
              : c.action === "farm"
                ? report?.summary.match(/harvested (\d+) food/)?.[1] +
                  " food harvested"
                : c.action === "build"
                  ? repair
                    ? "Repairing the market"
                    : "Building the library"
                  : c.action === "socialize"
                    ? `Chatting${target ? " with " + target : ""}`
                    : c.action === "alliance"
                      ? `Allying${target ? " with " + target : ""}`
                      : c.action === "help"
                        ? `Helping${target ? " " + target : ""}`
                        : c.action === "steal"
                          ? "Making trouble"
                          : c.action === "campaign"
                            ? "Vote for me!"
                            : c.action === "protest"
                              ? "We deserve better!"
                              : c.action === "rest"
                                ? "A little rest…"
                                : c.action === "trade"
                                  ? "Trading at the market"
                                  : c.job === "Woodcutter"
                                    ? "Gathering timber"
                                    : "Hard at work";
  useFrame(({ clock }) => {
    if (!group.current) return;
    const progress = movementProgress({
      paused,
      pausedAt: frozenAt,
      updatedAt,
      speed,
    });
    const [x, z] = pointAlong(path, progress);
    const [nx, nz] = pointAlong(path, Math.min(1, progress + 0.01));
    const walking =
      progress < 0.999 &&
      Math.hypot(
        c.position[0] - c.previousPosition[0],
        c.position[1] - c.previousPosition[1],
      ) > 0.1;
    const t = clock.elapsedTime;
    group.current.position.set(
      x,
      0.12 +
        (walking && !paused
          ? Math.sin(t * 9 + c.name.length) * 0.04
          : Math.sin(t * 2) * 0.015),
      z,
    );
    if (walking) group.current.rotation.y = Math.atan2(nx - x, nz - z);
    else if (["reflect", "publish"].includes(c.action))
      group.current.rotation.y = Math.PI;
    if (bodyPose.current) {
      bodyPose.current.rotation.x =
        !walking && c.action === "rest" ? -Math.PI / 2 : 0;
      bodyPose.current.position.y = !walking && c.action === "rest" ? 0.65 : 0;
    }
    if (left.current && right.current && arm.current) {
      left.current.rotation.x = walking && !paused ? Math.sin(t * 9) * 0.55 : 0;
      right.current.rotation.x = -left.current.rotation.x;
      arm.current.rotation.x = walking
        ? right.current.rotation.x
        : [
              "farm",
              "build",
              "work",
              "reflect",
              "publish",
              "discuss",
              "propose",
            ].includes(c.action) && !paused
          ? Math.sin(t * 4) * 0.9
          : 0;
      if (otherArm.current)
        otherArm.current.rotation.x = walking
          ? -arm.current.rotation.x
          : ["reflect", "publish"].includes(c.action)
            ? -0.7 + Math.sin(t * 5) * 0.15
            : 0;
    }
  });
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        select(c.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position-y={0.18} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial
          color={selected ? "#edc166" : "#426644"}
          transparent
          opacity={selected ? 0.9 : 0.18}
        />
      </mesh>
      <group ref={bodyPose}>
        <group ref={left} position={[-0.14, 0.85, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.48, 4, 7]} />
            {material("#384955")}
          </mesh>
          <Box p={[0, -0.65, 0.08]} s={[0.23, 0.13, 0.37]} c="#27333c" />
        </group>
        <group ref={right} position={[0.14, 0.85, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.48, 4, 7]} />
            {material("#384955")}
          </mesh>
          <Box p={[0, -0.65, 0.08]} s={[0.23, 0.13, 0.37]} c="#27333c" />
        </group>
        <mesh position={[0, 1.22, 0]} scale={[1, 0.95, 0.7]} castShadow>
          <capsuleGeometry args={[0.27, 0.38, 5, 9]} />
          {material(c.color)}
        </mesh>
        <mesh position={[0, 1.69, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.2, 7]} />
          {material(c.skin)}
        </mesh>
        <mesh position={[0, 1.96, 0]} scale={[0.9, 1.15, 0.9]} castShadow>
          <sphereGeometry args={[0.27, 12, 9]} />
          {material(c.skin)}
        </mesh>
        <mesh position={[0, 2.11, -0.02]}>
          <sphereGeometry
            args={[0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5]}
          />
          {material(
            ["#524030", "#aa8559", "#333539"][Number(c.id.split("-")[1]) % 3],
          )}
        </mesh>
        <group ref={arm} position={[-0.36, 1.5, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.36, 4, 7]} />
            {material(c.color)}
          </mesh>
          <mesh position={[0, -0.52, 0]}>
            <sphereGeometry args={[0.095, 7, 6]} />
            {material(c.skin)}
          </mesh>
          <Box
            p={[0, -0.1, 0.08]}
            s={[0.15, 0.1, 0.03]}
            c={c.provider === "terra" ? "#78d8e5" : "#e5b279"}
          />
          {["farm", "build", "work"].includes(c.action) && (
            <group position={[0, -0.58, 0.1]}>
              <Box p={[0, -0.2, 0]} s={[0.06, 0.8, 0.06]} c="#a88a64" />
              <Box p={[0.1, 0.1, 0]} s={[0.38, 0.14, 0.16]} c="#a0b2b6" />
            </group>
          )}
        </group>
        <group ref={otherArm} position={[0.36, 1.5, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.36, 4, 7]} />
            {material(c.color)}
          </mesh>
          <mesh position={[0, -0.52, 0]}>
            <sphereGeometry args={[0.095, 7, 6]} />
            {material(c.skin)}
          </mesh>
        </group>
        {[-0.09, 0.09].map((x) => (
          <Box
            key={x}
            p={[x, 1.99, 0.24]}
            s={[0.035, 0.04, 0.02]}
            c="#273136"
          />
        ))}
      </group>
      {(active || observation) && !selected && !hover && (
        <WorldHtml
          position={[0, 2.6, 0]}
          center
          distanceFactor={active ? 38 : 22}
          zIndexRange={[25, 0]}
        >
          <div
            className={`activity-label ${c.action} ${!active ? "nameplate" : ""}`}
          >
            <span className={`dot ${c.provider}`} />
            {active
              ? activity?.startsWith("undefined")
                ? "Tending the crops"
                : activity
              : c.name}
            {active && <small>{c.name}</small>}
          </div>
        </WorldHtml>
      )}
      {selected && writing && (
        <WorldHtml
          position={[1.7, 3.3, 0]}
          center
          distanceFactor={10}
          zIndexRange={[30, 0]}
        >
          <button
            className="world-writing"
            onClick={() => openWriting(writing.id)}
          >
            <span>
              {writing.kind.toUpperCase()} ·{" "}
              {writing.source === "ai"
                ? "AI-authored"
                : writing.source === "fallback"
                  ? "Fallback"
                  : "Demo"}
            </span>
            <strong>{writing.title}</strong>
            <p>{writing.body.slice(0, 140)}…</p>
            <small>Read the full entry →</small>
          </button>
        </WorldHtml>
      )}
      {(selected || hover) && (
        <WorldHtml
          position={[0, 2.65, 0]}
          center
          distanceFactor={12}
          zIndexRange={[30, 0]}
        >
          <div className="citizen-label">
            <span className={`dot ${c.provider}`} />
            {c.name}
            <small>{c.action}</small>
          </div>
        </WorldHtml>
      )}
      {selected &&
        ["socialize", "alliance", "campaign", "help"].includes(c.action) && (
          <WorldHtml position={[0, 3.5, 0]} center zIndexRange={[30, 0]}>
            <div className="speech">{c.message}</div>
          </WorldHtml>
        )}
    </group>
  );
}
function Landscape() {
  const observation = useTown((s) => s.observation);
  const flowers = useMemo(
    () =>
      Array.from({ length: 160 }, (_, i) => {
        const x = Math.sin(i * 47.13) * 32,
          z = Math.cos(i * 31.7) * 34;
        return [x, z] as Point;
      }),
    [],
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obj = new THREE.Object3D();
    flowers.forEach(([x, z], i) => {
      obj.position.set(x, 0.2, z);
      obj.scale.setScalar(0.09 + (i % 3) * 0.025);
      obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix);
      ref.current!.setColorAt(
        i,
        new THREE.Color(
          i % 3 === 0 ? "#ecdbab" : i % 3 === 1 ? "#b9c07c" : "#c99e8e",
        ),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [flowers]);
  return (
    <>
      <Box
        p={[0, -1.15, 0]}
        s={[72, 2, 78]}
        c={observation ? "#354a3e" : "#a79c74"}
      />
      <Box
        p={[0, -0.25, 0]}
        s={[72, 0.6, 78]}
        c={observation ? "#44614d" : "#a8b780"}
      />
      {[-16, 0, 16].map((z) => (
        <Box
          key={z}
          p={[0, 0.08, z]}
          s={[56, 0.12, 2.3]}
          c={observation ? "#58666b" : "#d8c9a5"}
        />
      ))}
      <Box
        p={[0, 0.09, 0]}
        s={[2.4, 0.13, 61]}
        c={observation ? "#58666b" : "#d8c9a5"}
      />
      {buildings
        .filter((b) => b.kind !== "fountain")
        .map((b) => {
          const z = b.position[1],
            lane = z < -16 ? -16 : z > 16 ? 16 : 0;
          return (
            <Box
              key={b.id}
              p={[b.position[0], 0.07, (z + lane) / 2]}
              s={[1.7, 0.1, Math.abs(z - lane)]}
              c={observation ? "#58666b" : "#d8c9a5"}
            />
          );
        })}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.17, 1]}>
        <circleGeometry args={[5, 32]} />
        {material(observation ? "#677a75" : "#d3c7a7")}
      </mesh>
      {Array.from({ length: 26 }, (_, i) => (
        <Tree
          key={i}
          position={[i < 13 ? -32 : 32, 0, -34 + (i % 13) * 5.5]}
          scale={0.65 + (i % 4) * 0.14}
          round={i % 3 === 0}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          position={[-29 + i * 8, 0, -37]}
          scale={[5, 2 + (i % 3), 4]}
        >
          <icosahedronGeometry args={[1, 1]} />
          {material(i % 2 ? "#9dac78" : "#91a16f")}
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial />
      </instancedMesh>
      {[-8, 8].flatMap((x) =>
        [-16, 0, 16].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z + 2]}>
            <Box p={[0, 0.8, 0]} s={[0.12, 1.6, 0.12]} c="#74745b" />
            <Box p={[0, 1.8, 0]} s={[0.5, 0.5, 0.5]} c="#f3dfac" />
            <mesh position={[0, 2.15, 0]}>
              <coneGeometry args={[0.44, 0.3, 4]} />
              {material("#6e735b")}
            </mesh>
          </group>
        )),
      )}
      {[-5, 5].map((x) => (
        <group key={x} position={[x, 0, 5]}>
          <Box p={[0, 0.5, 0]} s={[1.9, 0.18, 0.65]} c="#947e59" />
          <Box p={[0, 0.95, -0.25]} s={[1.9, 0.6, 0.12]} c="#a28a60" />
          {[-0.7, 0.7].map((j) => (
            <Box key={j} p={[j, 0.25, 0]} s={[0.12, 0.5, 0.5]} c="#687357" />
          ))}
        </group>
      ))}
    </>
  );
}
function Atmosphere() {
  const cloud = useRef<THREE.Group>(null),
    smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (cloud.current)
      cloud.current.position.x = Math.sin(clock.elapsedTime * 0.017) * 9;
    if (smoke.current)
      smoke.current.position.y = (clock.elapsedTime * 0.22) % 2;
  });
  return (
    <>
      <group ref={cloud}>
        {[
          [-20, 16, -25],
          [22, 19, -20],
          [-18, 18, 25],
        ].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            {[0, 1, 2].map((j) => (
              <mesh
                key={j}
                position={[j * 2, Math.sin(j) * 0.8, 0]}
                scale={[2.7, 1.1, 1.5]}
              >
                <icosahedronGeometry args={[1, 1]} />
                <meshStandardMaterial
                  color="#f6f5e9"
                  transparent
                  opacity={0.8}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <group ref={smoke} position={[-22, 0, -21]}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[i * 0.3, 4 + i * 0.7, 0]}
            scale={0.3 + i * 0.14}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color="#e3dfcc"
              transparent
              opacity={0.3 - i * 0.07}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const observation = useTown((s) => s.observation);
  const reset = useTown((s) => s.cameraReset),
    following = useTown((s) => s.following),
    cinematic = useTown((s) => s.cinematic);
  const citizens = useTown((s) => s.world.citizens),
    motionWorld = useTown((s) => s.world);
  useEffect(() => {
    camera.position.set(
      ...((observation ? [38, 29, 43] : [56, 51, 63]) as [
        number,
        number,
        number,
      ]),
    );
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [reset, camera, observation]);
  const focusRemaining = useRef(0);
  useEffect(() => {
    focusRemaining.current = following ? 1.5 : 0;
  }, [following]);
  useFrame((_, delta) => {
    if (following && controls.current) {
      const c = citizens.find((c) => c.id === following);
      if (c) {
        const [x, z] = pointAlong(
          roadPath(c.previousPosition, c.position),
          movementProgress(motionWorld),
        );
        const target = new THREE.Vector3(x, 1, z);
        const diff = target
          .clone()
          .sub(controls.current.target)
          .multiplyScalar(1 - Math.exp(-delta * 2));
        camera.position.add(diff);
        if (focusRemaining.current > 0) {
          camera.position.lerp(
            target
              .clone()
              .add(
                observation
                  ? new THREE.Vector3(6.5, 4.5, 8)
                  : new THREE.Vector3(10, 9, 13),
              ),
            1 - Math.exp(-delta * 3),
          );
          focusRemaining.current -= delta;
        }
        controls.current.target.add(diff);
        controls.current.update();
      }
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.25}
      minDistance={7}
      maxDistance={135}
      autoRotate={cinematic}
      autoRotateSpeed={0.35}
      onStart={() => {
        if (following) useTown.getState().follow(null);
      }}
    />
  );
}
function ElectionCelebration() {
  const active = useTown(
    (s) =>
      s.world.celebrationTick === s.world.tick ||
      (s.world.tick > 0 && s.world.tick % 60 === 0),
  );
  const confetti = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!active || !confetti.current) return;
    for (let i = 0; i < 40; i++) {
      const phase = (clock.elapsedTime * 0.22 + i / 40) % 1;
      const angle = i * 2.4 + clock.elapsedTime * 0.2;
      transform.position.set(
        Math.cos(angle) * (2 + (i % 4)),
        7 * (1 - phase) + 0.5,
        1 + Math.sin(angle) * (2 + (i % 4)),
      );
      transform.rotation.set(phase * 8, angle, phase * 4);
      transform.scale.set(0.12, 0.22, 0.06);
      transform.updateMatrix();
      confetti.current.setMatrixAt(i, transform.matrix);
    }
    confetti.current.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => {
    if (!confetti.current) return;
    for (let i = 0; i < 40; i++)
      confetti.current.setColorAt(
        i,
        new THREE.Color(["#ddb66b", "#8da6ad", "#bd8d76", "#8fa775"][i % 4]),
      );
    if (confetti.current.instanceColor)
      confetti.current.instanceColor.needsUpdate = true;
  }, [active]);
  return active ? (
    <instancedMesh ref={confetti} args={[undefined, undefined, 40]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  ) : null;
}
function Scene() {
  const observation = useTown((s) => s.observation);
  const [wave, setWave] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setWave((w) => w + 1), 4000);
    return () => clearInterval(timer);
  }, []);
  const citizens = useTown((s) => s.world.citizens),
    night = useTown((s) => s.world.tick % 6 >= 4);
  return (
    <>
      <color
        attach="background"
        args={[
          observation
            ? night
              ? "#14232c"
              : "#2b4246"
            : night
              ? "#9caeaa"
              : "#e6ebdc",
        ]}
      />
      <fog
        attach="fog"
        args={[
          observation
            ? night
              ? "#14232c"
              : "#2b4246"
            : night
              ? "#9caeaa"
              : "#e6ebdc",
          110,
          210,
        ]}
      />
      <ambientLight intensity={night ? 0.65 : 1.5} />
      <hemisphereLight args={["#eef3e0", "#788450", 1.1]} />
      <directionalLight
        position={[-20, 40, 10]}
        intensity={night ? 0.5 : 2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-normalBias={0.04}
      />
      <Landscape />
      {buildings.map((b) => (
        <TownBuilding key={b.id} building={b} />
      ))}
      {citizens.map((c) => (
        <CitizenAvatar key={c.id} citizen={c} wave={wave} />
      ))}
      <Atmosphere />
      <ElectionCelebration />
      <ContactShadows
        position={[0, -1.6, 0]}
        opacity={0.2}
        scale={105}
        blur={3}
        far={12}
        resolution={256}
        frames={1}
      />
      <CameraRig />
    </>
  );
}
export default function Town() {
  const [labels, setLabels] = useState<HTMLDivElement | null>(null);
  const portal = useMemo<RefObject<HTMLElement> | undefined>(
    () => (labels ? { current: labels } : undefined),
    [labels],
  );
  return (
    <div className="town-canvas">
      <div ref={setLabels} className="world-labels" />
      {portal && (
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [56, 51, 63], fov: 42, near: 0.1, far: 250 }}
          onPointerMissed={() => useTown.getState().select(null)}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <LabelsPortal.Provider value={portal}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </LabelsPortal.Provider>
        </Canvas>
      )}
    </div>
  );
}
