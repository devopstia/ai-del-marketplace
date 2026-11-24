// Instructor studio endpoints in one place, so they can follow docs/API.md exactly.
const c = (id: string) => `/instructor/courses/${id}`;
export const E = {
  course: c,
  submit: (id: string) => `${c(id)}/submit`,
  revision: (id: string) => `${c(id)}/revision`,
  sections: (id: string) => `${c(id)}/sections`,
  section: (id: string, sid: string) => `${c(id)}/sections/${sid}`,
  lectures: (id: string, sid: string) => `${c(id)}/sections/${sid}/lectures`,
  lecture: (id: string, lid: string) => `${c(id)}/lectures/${lid}`,
  quiz: (id: string, lid: string) => `${c(id)}/lectures/${lid}/quiz`,
  resource: (id: string, rid: string) => `${c(id)}/resources/${rid}`,
  sectionOrder: (id: string) => `${c(id)}/sections/order`,
  lectureOrder: (id: string, sid: string) => `${c(id)}/sections/${sid}/lectures/order`,
  lectureResources: (id: string, lid: string) => `${c(id)}/lectures/${lid}/resources`,
  uploadVideo: "/instructor/uploads/video",
  completeVideo: (assetId: string) => `/instructor/uploads/video/${assetId}/complete`,
  uploadResource: "/instructor/uploads/resource",
  uploadImage: "/instructor/uploads/image",
};
